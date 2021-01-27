/*
References: 
https://medium.com/better-programming/ethereum-dapps-how-to-listen-for-events-c4fa1a67cf81
https://bitsofco.de/calling-smart-contract-functions-using-web3-js-call-vs-send/

Ethereum events: 
1) https://docs.metamask.io/guide/ethereum-provider.html#events
2) https://eips.ethereum.org/EIPS/eip-1193

Author: chuacw, Singapore, Singapore
Date: 24 Jan - 27 Jan 2021
*/
"strict mode"; 

const BTN_CONNECT = "#btnConnect";
const BTN_SENDETH = "#btnSendETH";
const ED_ETHSENDVALUE = "#edETHSendValue";
const BTN_LISTDONATIONS = "#btnListDonations";
const BTN_WITHDRAW = "#btnWithdraw";
const PNL_DONATIONS = "#donationsPanel";
const LBL_WALLET_ADDRESS = "#WalletAddressValue";
const LBL_CONTRACT_ADDRESS = "#ContractAddressValue";

const CLICK = "click";
const DATA = "data";
const DISABLED = "disabled";


const CHAINCHANGED = "chainChanged";
const ACCOUNTSCHANGED = "accountsChanged";
const CONNECT = "connect";
const DISCONNECT = "disconnect";

var eventsHooked = false;

function compareAddress(addr1, addr2) {
  let _addr1 = addr1.toLowerCase();
  let _addr2 = addr2.toLowerCase();
  let result = _addr1 == _addr2;
  return result;
}

function wordwrap( str, width, brk, cut ) {
  brk = brk || 'n';
  width = width || 75;
  cut = cut || false;

  if (!str) { return str; }

  var regex = '.{1,' +width+ '}(\s|$)' + (cut ? '|.{' +width+ '}|.+$' : '|\S+?(\s|$)');
  return str.match( RegExp(regex, 'g') ).join( brk );
}

function handleAccountsChanged(accounts) {
  // debugger;
  if (accounts.length === 0) {
    // MetaMask is locked or the user has not connected any accounts
    App.disableDonateButton();
    App.disableListDonationsButton();
    App.disableWithdrawButton();
  } else {
    App.currentAccount = accounts[0];
    $(LBL_WALLET_ADDRESS).text(accounts[0]);
    if (App.instances && App.instances.Donation) {
      $(LBL_CONTRACT_ADDRESS).text(App.instances.Donation.address);
    }
    App.enableDonateButton();
    App.checkListDonationsButton();
    App.checkWithdrawButton();
  }
}

// define first so it's available to everyone
// function updateStatus(msg) {
//   let currentTime = new Date();
//   let line = `${currentTime.timeNow()} - ${msg}`;
//   console.log(`${line}`);
//   let status = $("#status");
//   status.text(`${line}`);
// }

function updateConnectionStatus() {
  let connected = ethereum.isConnected();
  (connected ? App.displayConnectedChainId(ethereum.chainId): App.updateStatus("Not connected."));
}

Date.prototype.timeNow = function(){     
  return ((this.getHours() < 10)?"0":"") + ((this.getHours()>12)?(this.getHours()-12):this.getHours()) +":"+ ((this.getMinutes() < 10)?"0":"") + this.getMinutes() +":"+ ((this.getSeconds() < 10)?"0":"") + this.getSeconds() + ((this.getHours()>12)?('PM'):'AM'); 
};

let App = {
  web3Provider: null,
  contracts: {},
  instances: {},

  elementExists: (name) => {
    let result = ($(name).length > 0);
    return result;
  },
  getTimestamp: () => {
    let timestamp = new Date() / 1000;
    return timestamp;
  },

  displayConnectedChainId: async (_chainId) => {
    let chainName = "";
    try {    
      let chainId = parseInt(_chainId);
      switch(chainId) {
        case 1: chainName = "mainnet";
          break; 
        case 3: chainName = "ropsten";
          break;
        case 4: chainName = "rinkeby";
          break;
        case 5: chainName = "goerli";
          break;
        case 42: chainName = "kovan";
          break;
        default:
          chainName = _chainId;
      }
    } catch (error) {
      chainName = _chainId; 
    }    
    App.updateStatus(`Connected to the Ethereum network chain id: ${chainName}.`);
  },

  disableDonateButton: () => {
    $(BTN_SENDETH).attr(DISABLED, true);
  },
  enableDonateButton: () => {
    debugger;
    $(BTN_SENDETH).removeAttr(DISABLED);
    // multiple calls to this method will cause multiple events, so unbind...
    $(BTN_SENDETH).unbind(CLICK);
    $(BTN_SENDETH).click(App.handleSendETH);
  },

  checkListDonationsButton: async() => {
    let instance = await App.setupDonationContract();
    let owner = await instance.owner();
    compareAddress(App.currentAccount, owner) ? App.enableListDonationsButton(): App.disableListDonationsButton();   
  },
  disableListDonationsButton: () => {
    $(BTN_LISTDONATIONS).attr(DISABLED, true);
    $(BTN_LISTDONATIONS).unbind(CLICK);
  },  
  enableListDonationsButton: async () => {
    $(BTN_LISTDONATIONS).removeAttr(DISABLED);
    $(BTN_LISTDONATIONS).unbind(CLICK);
    $(BTN_LISTDONATIONS).click(App.handleListDonations);
  },

  checkWithdrawButton: async () => {
    let instance = await App.setupDonationContract();
    let owner = await instance.owner();
    compareAddress(App.currentAccount, owner) ? App.enableWithdrawButton(): App.disableWithdrawButton();
  },
  disableWithdrawButton: () => {
    $(BTN_WITHDRAW).attr(DISABLED, true);
    $(BTN_WITHDRAW).unbind(CLICK);
  },
  enableWithdrawButton: () => {
    $(BTN_WITHDRAW).removeAttr(DISABLED);
    $(BTN_WITHDRAW).unbind(CLICK);
    $(BTN_WITHDRAW).click(App.handleWithdraw);
  },

  eventAccountsChanged: (accounts) => {
    debugger;
    let connected = ethereum.isConnected();
    App.handleAccountsChanged(accounts);
    App.updateStatus(`Accounts updated. There is/are now ${accounts.length} account(s) available.`);
  },
  eventConnected: (connectInfo) => {
    debugger;
    if (ethereum.chainId != null) {
      // App.updateStatus(`Connected to the Ethereum network chain id: ${ethereum.chainId}.`);
      App.displayConnectedChainId();
    }
  },
  eventDisconnected: (error) => {
    App.displayDisconnected();
  },
  eventChainChanged: async (chainId) => {
    debugger;
    if (App.instances.Donation != null) {
      let instance = App.instances.Donation;
      App.listenReceived(instance);
      App.listenWithdrawn(instance);
    }
    delete App.instances.Donation; // reset instances
    let instance = await App.setupDonationContract();
    App.checkAccountsUpdate();
    App.clearLog();
  },

  checkAccountsUpdate: async () => {
    let accounts = await ethereum.request({ method: 'eth_requestAccounts' });
    App.handleAccountsChanged(accounts);
  },
  handleAccountsChanged: (accounts) => {
    // debugger;
    if (accounts.length === 0) {
      // MetaMask is locked or the user has not connected any accounts
      App.disableDonateButton();
      App.disableListDonationsButton();
      App.disableWithdrawButton();
    } else {
      App.currentAccount = accounts[0];
      $(LBL_WALLET_ADDRESS).text(accounts[0]);
      if (App.instances && App.instances.Donation) {
        $(LBL_CONTRACT_ADDRESS).text(App.instances.Donation.address);
      }
      App.enableDonateButton();
      App.checkListDonationsButton();
      App.checkWithdrawButton();
    }
  },

  handleListDonations: async () => {

        // debugger;
        App.updateStatus("Listening for donations...");
        await App.initWeb3();
        let instance = await App.setupDonationContract();
        // list all previous donations
        let address = instance.address;
        let topic = web3.eth.abi.encodeEventSignature("Received(address,uint256,uint256)");

        let logs = await web3.eth.getPastLogs({fromBlock: 0, toBlock: 'latest', address: address, topics: [topic]});
        {
          debugger;
          // https://ethereum.stackexchange.com/questions/87653/how-to-decode-log-event-of-my-transaction-log
          const typesArray = [
            {type: 'address', name: 'sender', indexed: true}, 
            {type: 'uint', name: 'amount'},
            {type: 'uint', name: 'count'}
          ];
          let currentBalance = await instance.getBalance();
          for (let i=0; i<logs.length; i++) {
              try {
                let log = logs[i];
                let data = log.data;
                let x = async(data) =>{
                  // let massagedData = data.replace("0x", "");
                  let decodedLog = web3.eth.abi.decodeLog(typesArray, data, log.topics.slice(1));
                  let blockNo = log.blockNumber;
                  let block = await web3.eth.getBlock(blockNo);
                  let timestamp = block.timestamp;
                  let sender = decodedLog.sender;
                  let amount = web3.utils.fromWei(`${decodedLog.amount}`, "ether");
                  let count = decodedLog.count;
                  let msg = `Received ${amount} ETH from ${sender}.`;
                  // debugger;
                  App.updateLog(timestamp, msg);
                };
                await x(data);
              } catch (error) {
                // handle errors
                App.updateLog("Error listing past logs: " + error.message);
              }            
          }
        };

        // now start listening to Received and Withdraw events
        App.listenReceived(instance);
        App.listenWithdrawn(instance);

  },

  handleWithdraw: async () => {
    try {
      await App.initWeb3();
      let instance = await App.setupDonationContract();
      App.listenWithdrawn(instance);
      await instance.emptyBalance({from: App.currentAccount});
    } catch (error) {
      let timestamp = App.getTimestamp();
      // use this to break the string into manageable length
      let stdmsg = 'Received 0.0244 ETH from 0x9785bebdC6F928Bc607175ac6D2d6Ac939C49c62.';
      let msg = wordwrap(error.message, stdmsg.length, "<br/>\n", true);
      App.updateLog(timestamp, msg);
    }    
  },

  hookEvents: () => {
    if (window.ethereum) {

      let connectListeners = ethereum.listeners(CONNECT);
      let disconnectListeners = ethereum.listeners(DISCONNECT);
      let accountsChangedListeners = ethereum.listeners(ACCOUNTSCHANGED);
      let chainChangedListeners = ethereum.listeners(CHAINCHANGED);

      debugger;
      ethereum.removeListener(CONNECT, App.eventConnected);
      ethereum.removeListener(DISCONNECT, App.eventDisconnected);
      ethereum.removeListener(ACCOUNTSCHANGED, App.eventAccountsChanged);
      ethereum.removeListener(CHAINCHANGED, App.eventChainChanged);

      ethereum.on(CONNECT, App.eventConnected);
      connectListeners = ethereum.listeners(CONNECT);

      ethereum.on(DISCONNECT, App.eventDisconnected);
      disconnectListeners = ethereum.listeners(DISCONNECT);

      ethereum.on(ACCOUNTSCHANGED, App.eventAccountsChanged);
      accountsChangedListeners = ethereum.listeners(ACCOUNTSCHANGED);

      ethereum.on(CHAINCHANGED, App.eventChainChanged); 
      chainChangedListeners = ethereum.listeners(CHAINCHANGED);
    }
  },

  logReceived: async (data) => {
    debugger;
    try {
      let sender = data.args.sender;
      let amount = web3.utils.fromWei(`${data.args.amount}`, "ether");
      // if the list element doesn't exist, then update the received donation on the status bar
      if (!App.elementExists(BTN_LISTDONATIONS)) {
        App.updateStatus(`Thank you, ${sender} for your donation of ${amount} ether.`);
      } else {
        // since the list donations button exists, this must be the received page, so list it.
        let x = async function() {
          let tx = data.transactionHash;
          let blockNo = data.blockNumber;
          let block = await web3.eth.getBlock(blockNo);
          let timestamp = block.timestamp;
          let sender = data.args.sender;
          let amount = web3.utils.fromWei(`${data.args.amount}`, "ether");
          let count = data.args.count;
          let msg = `Received ${amount} ETH from ${sender}.`;            
          App.updateLog(timestamp, msg);
        }
        await x();
      }
    } catch (error) {
      let timestamp = App.getTimestamp();
      App.updateLog(timestamp, "error showing log: " + error.message);
    }
  },
  logWithdrawn: async (data) => {
    debugger;
    try {
      let amount = web3.utils.fromWei(`${data.args.amount}`, "ether");
      let x = async function() {
        let tx = data.transactionHash;
        let blockNo = data.blockNumber;
        let block = await web3.eth.getBlock(blockNo);
        let timestamp = block.timestamp;
        let receiver = data.args.receiver;
        let amount = web3.utils.fromWei(`${data.args.amount}`, "ether");
        let msg = `${amount} ETH withdrawn to ${receiver}.`;            
        App.updateLog(timestamp, msg);
      }
      await x();
    } catch (error) {
      let timestamp = App.getTimestamp();
      App.updateLog(timestamp, "error showing log: " + error.message);
    }
  },

  listenReceived: (instance) => {
    // Calling this more than once would cause duplicate events to be displayed
    debugger;
    let timestamp = App.getTimestamp();
    App.updateLog(timestamp, "Adding received listener...")
    const event = instance.Received();
    let listeners = event.listeners(DATA);
    for(let listener in listeners) {
      if (listener == App.logReceived) {
        event.removeListener(DATA, App.logReceived);
      }
    }
    event.on(DATA, App.logReceived);
    timestamp = App.getTimestamp();
    App.updateLog(timestamp, "Received listener added.")
    let listeners2 = event.listeners(DATA);
    if (listeners != listeners2) {}
  },
  listenWithdrawn: (instance) => {
    // Calling this more than once would cause duplicate events to be displayed
    debugger;
    let timestamp = App.getTimestamp();
    App.updateLog(timestamp, "Adding withdrawn listener...");
    const event = instance.Withdrawn();
    let listeners = event.listeners(DATA);
    for(let listener in listeners) {
      if (listener == App.logWithdrawn) {
        event.removeListener(DATA, App.logWithdrawn);
      }
    }
    event.removeListener(DATA, App.logWithdrawn);
    event.on(DATA, App.logWithdrawn);
    timestamp = App.getTimestamp();
    App.updateLog(timestamp, "Withdrawn listener added.");
  },

  // define first so it's available to everyone
  updateStatus: (msg) => {
    let currentTime = new Date();
    let line = `${currentTime.timeNow()} - ${msg}`;
    console.log(`${line}`);
    let status = $("#status");
    status.text(`${line}`);
  },

  clearLog: () => {
    let donationsLog = $(PNL_DONATIONS);
    donationsLog.empty(); // clear contents
  },
  updateLog: (timestamp, msg) => {
    let currentTime = new Date(timestamp * 1000);
    let currentDate = `${currentTime.getFullYear()}-${(currentTime.getMonth()+1).toString().padStart(2, '0')}-${currentTime.getDate().toString().padStart(2, '0')}`
    let line = `${currentDate} ${currentTime.timeNow()} - ${msg}`;
    console.log(`${line}`);
    let donationsLog = $(PNL_DONATIONS);
    donationsLog.append(`${line}<br>`);
    // auto-scrolling
    // status.scrollTop(status.prop("scrollHeight")); // works if statusbar doesn't exist
    $(window).scrollTop( $(window).scrollTop()+100 ); // works with or without status bar at the bottom   
  },

  handleSendETH: async () => {
    try {
      await App.initWeb3();
      let instance = await App.setupDonationContract();
      App.updateStatus("Calling donateETH");

      // event subscription
      debugger;

      let amountToSend = $(ED_ETHSENDVALUE).val();
      let ETHdata = {
        from: App.currentAccount, 
        value: web3.utils.toHex( web3.utils.toWei(`${amountToSend}`, "ether") )
      };
      // debugger;
      let results = await instance.donateETH(ETHdata);
      App.updateStatus("donateETH call completed.");
    } catch (error) {
      App.updateStatus("donateETH error: " + error.message);
    }
    return true;   
  },

  setupDonationContract: async () => {
    if (App.contracts.Donation === undefined || App.instances === undefined || App.instances.Donation === undefined) {
      try {
        let data = App.DonationArtifact || await $.getJSON('Donation.json');
        if (App.DonationArtifact === undefined) {
          App.DonationArtifact = data; // setup the DonationArtifact
        }
        App.contracts.Donation = TruffleContract(data); // data is DonationArtifact
        if (App.web3Provider === undefined || App.web3Provider == null) {
          App.initWeb3Provider();
        }
        App.contracts.Donation.setProvider(App.web3Provider);
        let instance = await App.contracts.Donation.deployed();
        $(LBL_CONTRACT_ADDRESS).text(instance.address);
        debugger;
        App.instances.Donation = instance;
        // App.listenReceived(instance); // 
      } catch (err) {
        App.updateStatus(err);
        throw err;
      }
    }
    return App.instances.Donation;
  },

  init: async () => {
    debugger;
    App.initWeb3Provider();
    if (window.ethereum) {
      await ethereum.enable();
    }
    updateConnectionStatus();
    // let accounts = await ethereum.request({ method: 'eth_requestAccounts' });
    // handleAccountsChanged(accounts);
    App.checkAccountsUpdate();
    $(BTN_CONNECT).click(App.handleConnect); // hook up the connect button
    App.hookEvents();
    if (App.elementExists(BTN_LISTDONATIONS)) {
      App.checkListDonationsButton();
      App.checkWithdrawButton();
    } else {
      if (ethereum.isConnected()) {
        App.enableDonateButton();
      }
    }
    return true;
  },

  handleConnect: async () => {
    debugger;
    await App.setupDonationContract();
    return true;
  },

  initWeb3Provider: () => {
    if (window.ethereum) {
      App.web3Provider = window.ethereum;
    } else if (window.web3) {
      App.web3Provider = window.web3.currentProvider;
    } else {
      App.web3Provider = new Web3.providers.HttpProvider("http://localhost:7545");
    }
    web3 = new Web3(App.web3Provider);
  },

  initWeb3: async () => {
    if (window.ethereum) {     
      App.web3Provider = window.ethereum;     
      try {
        debugger;

        // if this is already connected, it might not call the existing hooked events
        // let accounts = await ethereum.request({ method: 'eth_requestAccounts' });
        // App.handleAccountsChanged(accounts);
        App.checkAccountsUpdate();
        App.hookEvents();

        // App.updateStatus("Call to eth_requestAccounts completed.");
        // debugger;
      } catch (error) {       
        App.updateStatus("User denied account access: " + error);     
      }   
    }
    return true;
  }

};

$(function() {

  // on window load, call application init
  $(window).load(async function() {
    await App.init();
  });
});
