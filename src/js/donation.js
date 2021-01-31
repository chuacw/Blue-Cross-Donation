/*
References: 
https://medium.com/better-programming/ethereum-dapps-how-to-listen-for-events-c4fa1a67cf81
https://bitsofco.de/calling-smart-contract-functions-using-web3-js-call-vs-send/

Ethereum events: 
1) https://docs.metamask.io/guide/ethereum-provider.html#events
2) https://eips.ethereum.org/EIPS/eip-1193

Author: chuacw, Singapore, Singapore
Date: 23 Jan - 30 Jan 2021
*/
"strict mode"; 

const BTN_CONNECT = "#btnConnect";

const BTN_SENDETH = "#btnSendETH";
const BTN_REFUNDETH = "#btnRefundETH";
const ED_ETHSENDVALUE = "#edETHSendValue";

const BTN_LISTDONATIONS = "#btnListDonations";
const BTN_SETADMINFEE = "#btnSetAdminFee";
const ED_ADMINFEE = "#edAdminFee";
const BTN_WITHDRAW = "#btnWithdraw";
const BTN_TOGGLEREFUND = "#btnToggleRefund";

const PNL_DONATIONS = "#donationsPanel";
const LBL_WALLET_ADDRESS = "#WalletAddressValue";
const LBL_CONTRACT_ADDRESS = "#ContractAddressValue";
const LBL_CONTRACT_BALANCE = "#ContractBalanceValue";
const LBL_OWNER_ADDRESS = "#OwnerAddressValue";
const LBL_NETWORK_NAME = "#NetworkNameValue";
const LBL_ADMINFee = "#AdminFeeValue";
const LBL_REFUNDOK = "#RefundOkValue";

const CLICK = "click";
const DATA = "data";
const DISABLED = "disabled";


const CHAINCHANGED = "chainChanged";
const ACCOUNTSCHANGED = "accountsChanged";
const CONNECT = "connect";
const DISCONNECT = "disconnect";

var eventsHooked = false;

function compareAddress(addr1, addr2) {
  let result = false;
  if (addr1 && addr2) {
    let _addr1 = addr1.toLowerCase();
    let _addr2 = addr2.toLowerCase();
    result = _addr1 == _addr2;
  }
  return result;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function wordwrap( str, width, brk, cut ) {
  brk = brk || 'n';
  width = width || 75;
  cut = cut || false;

  if (!str) { return str; }

  var regex = '.{1,' +width+ '}(\s|$)' + (cut ? '|.{' +width+ '}|.+$' : '|\S+?(\s|$)');
  return str.match( RegExp(regex, 'g') ).join( brk );
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

  ConnectWeb3: async () => {
    await window.ethereum.request({
      method: "wallet_requestPermissions",
      params: [
        {
          eth_accounts: {}
        }
      ]
    });
  },
  
  weiToEther: (value) => {
    let amount = web3.utils.fromWei(`${value}`, "ether");
    return amount;
  },
  etherToWei: (value) => {
    let amount = web3.utils.toHex( web3.utils.toWei(`${value}`, "ether") );
    return amount;
  },

  // event messages
  getAdminFeeChangedMsg: (event) => {
    let amount = web3.utils.fromWei(`${event.amount}`, "ether");
    let msg = `Admin fee is now: ${amount} ETH.`;
    return msg;  
  },
  getReceivedETHMsg: (event) => {
    let sender = event.sender;
    let amount = web3.utils.fromWei(`${event.amount}`, "ether");
    let msg = `Received ${amount} ETH from ${sender}.`;
    return msg;
  },
  getRefundOkMsg: (event) => {
    if (typeof event.RefundOk != "undefined") {
      event.refundOk = event.RefundOk; // temp fix;
    } 
    let yesno = (event.refundOk?"yes":"no");
    let msg = `Refund allowed: ${yesno}.`;
    return msg;           
  },
  getWithdrawnMsg: (event) => {
    let receiver = event.receiver;
    let amount = web3.utils.fromWei(`${event.amount}`, "ether");
    let msg = `Withdrawn ${amount} ETH to ${receiver}.`;
    return msg;
  },

  displayConnectedChainId: (_chainId) => {
    let chainName = App.getChainName(_chainId);
    App.updateStatus(`Connected to the Ethereum network chain id: ${chainName}.`);
  },
  displayDisconnected: () => {
    App.updateStatus("Disconnected.");
  },
  getChainName: (_chainId) => {
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
    return chainName;    
  },
  disableDonateButton: () => {
    App.disableButton(BTN_SENDETH);
  },
  enableDonateButton: () => {
    App.disableDonateButton();
    App.enableButton(BTN_SENDETH, App.handleSendETH);
    App.enableConnectButton();
  },
  disableRefundButton: () => {
    App.disableButton(BTN_REFUNDETH);
  },
  enableRefundButton: () => {
    App.enableButton(BTN_REFUNDETH, App.handleRefundETH);
  },
  disableButton: (name) => {
    if (App.elementExists(name)) {
      $(name).attr(DISABLED, true);
      $(name).unbind(CLICK);
    }
  },
  enableButton: (name, handler) => {
    if (App.elementExists(name)) {
      $(name).removeAttr(DISABLED);
      $(name).unbind(CLICK);
      if (handler == undefined) {
        throw "handler undefined!";
      }
      $(name).click(handler);
    }
  },
  checkListDonationsButton: async() => {
    let instance = await App.setupDonationContract();
    let owner = await instance.owner();
    compareAddress(App.currentAccount, owner) ? App.enableListDonationsButton(): App.disableListDonationsButton();   
  },
  disableListDonationsButton: () => {
    App.disableButton(BTN_LISTDONATIONS);
  },  
  enableListDonationsButton: () => {
    App.enableButton(BTN_LISTDONATIONS, App.handleListDonations);
  },
  enableConnectButton: () => {
    App.enableButton(BTN_CONNECT, App.handleConnect);
  },
  checkAdminButtons: async () => {
    let instance = await App.setupDonationContract();
    let owner = await instance.owner();
    if (compareAddress(App.currentAccount, owner)) {
      App.enableAdminButtons();
    } else {
      App.disableAdminButtons();
    }    
  },
  enableAdminButtons: () => {
    App.enableWithdrawButton();
    App.enableSetAdminFeeButton();
    App.enableToggleRefundButton();
  },
  disableAdminButtons: () => {
    App.disableWithdrawButton();
    App.disableSetAdminFeeButton();
    App.disableToggleRefundButton();
  },
  checkWithdrawButton: async () => {
    let instance = await App.setupDonationContract();
    let owner = await instance.owner();
    compareAddress(App.currentAccount, owner) ? App.enableWithdrawButton(): App.disableWithdrawButton();
  },
  disableWithdrawButton: () => {
    App.disableButton(BTN_WITHDRAW);
  },
  enableWithdrawButton: () => {
    App.enableButton(BTN_WITHDRAW, App.handleWithdraw);
  },
  disableToggleRefundButton: () => {
    App.disableButton(BTN_TOGGLEREFUND);
  },
  enableToggleRefundButton: () => {
    App.enableButton(BTN_TOGGLEREFUND, App.handleToggleRefund);
  },
  disableSetAdminFeeButton: () => {
    App.disableButton(BTN_SETADMINFEE);
  },
  enableSetAdminFeeButton: () => {
    App.enableButton(BTN_SETADMINFEE, App.handleSetAdminFee);
  },
  toggleRefundButton: async () => {
    if (App.instances == undefined || App.instances.Donation == undefined) {
      return;
    }
    let instance = App.instances.Donation;
    let refundOk;
    try {
      refundOk = await instance.refundOk({from: App.currentAccount});
      refundOk = !refundOk;
      await instance.setRefundOk(refundOk);
    } catch (error) {
      App.updateStatus(error);
    }
  },

  eventAccountsChanged: async (accounts) => {
    let connected = ethereum.isConnected();
    await App.handleAccountsChanged(accounts);
    App.updateStatus(`Accounts updated. There is/are now ${accounts.length} account(s) available.`);
  },
  eventConnected: (connectInfo) => {
    if (connectInfo.chainId != null) {
      App.displayConnectedChainId(connectInfo.chainId);
    }
  },
  eventDisconnected: (error) => {
    App.displayDisconnected();
  },
  eventChainChanged: async (chainId) => {
    if (App.instances.Donation != null) {
      let instance = App.instances.Donation;
      App.stopListening(instance);
    }
    delete App.instances.Donation; // reset instances
    await App.setupDonationContract();
    App.requestAccounts();
    App.clearLog();
    App.displayConnectedChainId(chainId);
    App.updateNetworkName(chainId);
    if (App.instances && typeof App.instances.Donation == "undefined") {
      App.disableListDonationsButton();
    } else {
      App.enableListDonationsButton();
    }
  },
  updateNetworkName: (chainId) => {
    if (App.elementExists(LBL_NETWORK_NAME)) {
      let chainName = App.getChainName(chainId);
      $(LBL_NETWORK_NAME).text(chainName);
    }
  },
  getBalance: async() => {
    let balance;
    try {
      let instance = App.instances.Donation;
      let amount = await instance.getBalance.call();
      balance = web3.utils.fromWei(`${amount}`, "ether");
    } catch (error) {
      balance = "Unable to retrieve contract balance.";
      App.updateStatus(error);
    }
    return balance;
  },
  showBalance: async () => {
    let balance = await App.getBalance();
    // update contract balance
    $(LBL_CONTRACT_BALANCE).text(`${balance} ETH`);
    return balance;
  },

  requestAccounts: async () => {
    try {
      let accounts = await ethereum.request({ method: 'eth_requestAccounts' });
      await App.handleAccountsChanged(accounts);
    } catch (error) {
      App.updateStatus(error.message);
    }
  },
  handleAccountsChanged: async (accounts) => {
    if (accounts.length === 0) {
      // MetaMask is locked or the user has not connected any accounts
      App.disableWithdrawButton();
    } else {
      App.currentAccount = accounts[0];
      $(LBL_WALLET_ADDRESS).text(accounts[0]);
      App.updateNetworkName(ethereum.chainId);
      if (App.instances && App.instances.Donation) {
        let instance = App.instances.Donation;
        // show contract address
        $(LBL_CONTRACT_ADDRESS).text(instance.address);
        // show owner address
        let owner = await instance.owner.call(); // await instance.owner.call(); // working
        $(LBL_OWNER_ADDRESS).text(owner);
        await App.showBalance();
      }
      await App.checkAdminButtons();
    }
  },

  displayLog: async (address, topic, typesArray, fn) => {
    let logs = await web3.eth.getPastLogs({fromBlock: 0, toBlock: 'latest', address: address, 
      topics: [topic]});
    // See https://howchoo.com/code/learn-the-slow-and-fast-way-to-append-elements-to-the-dom
    let c = document.createDocumentFragment(); 
    for (let i=0; i<logs.length; i++) {
      let log = logs[i];
      let data = log.data;
        
      let decodedLog = web3.eth.abi.decodeLog(typesArray, data, log.topics.slice(1));
      let blockNo = log.blockNumber;
      let block = await web3.eth.getBlock(blockNo);
      let timestamp = block.timestamp;

      let msg = fn(decodedLog);

      // App.updateLog(timestamp, msg);
      let line = App.getUpdateLog(timestamp, msg);
      var e = document.createElement("div");
      e.innerHTML = line;
      c.appendChild(e);
    }
    App.appendLog(c);
    
  },
  handleListDonations: async (event) => {

        // debugger;
        App.updateStatus("Listening for events...");

        let instance = await App.setupDonationContract();
        // list all previous donations
        let address = instance.address;
        let topic, logs;
        // topic = web3.eth.abi.encodeEventSignature("Received(address,uint256,uint256)");
        topic = web3.eth.abi.encodeEventSignature("Received(address,uint256,uint256)");
        // debugger;
        // https://ethereum.stackexchange.com/questions/87653/how-to-decode-log-event-of-my-transaction-log

        let typesArray;
        typesArray = [
          {type: 'address', name: 'sender', indexed: true}, 
          {type: 'uint256', name: 'amount'},
          {type: 'uint256', name: 'count'}
        ];
        await App.displayLog(address, topic, typesArray, (decodedLog) => {
          let msg = App.getReceivedETHMsg(decodedLog);
          return msg;
        });

        typesArray = [
          {type: "bool", name: "RefundOk"}
        ]
        topic = web3.eth.abi.encodeEventSignature("RefundStatusChanged(bool)"); 
        await App.displayLog(address, topic, typesArray, (decodedLog) => {
          let msg = App.getRefundOkMsg(decodedLog);           
          return msg;
        });

        typesArray = [
          {type: 'address', name: 'receiver', indexed: true}, 
          {type: 'uint256', name: 'amount'}
        ];
        topic = web3.eth.abi.encodeEventSignature("Withdrawn(address,uint256)");        
        await App.displayLog(address, topic, typesArray, (decodedLog) => {
          let msg = App.getWithdrawnMsg(decodedLog);
          return msg;
        });

        typesArray = [
          {type: 'uint256', name: 'amount'}
        ];
        topic = web3.eth.abi.encodeEventSignature("AdminFeeChanged(uint256)");
        await App.displayLog(address, topic, typesArray, (decodedLog) => {
          App.updateAdminFee(decodedLog.amount);
          let msg = App.getAdminFeeChangedMsg(decodedLog);
          return msg;
        });

        // now start listening to events: Received,  Withdraw, Refund, etc..
        App.listenReceived(instance);
        App.listenRefundOk(instance);
        App.listenWithdrawn(instance);
        App.listenAdminFeeChanged(instance);
  },
  handleSetAdminFee: async () => {
    try {
      let instance = await App.setupDonationContract();
      let amount = $(ED_ADMINFEE).val().trim();
      let adminFee = web3.utils.toHex( web3.utils.toWei(`${amount}`, "ether") );
      await instance.setAdminFee(adminFee, {from: App.currentAccount});
    } catch(error) {
      let timestamp = App.getTimestamp();
      App.updateLog(timestamp, error);
    }
  },
  handleToggleRefund: async () => {
    try {
      let instance = await App.setupDonationContract();
      let refundOk = await instance.refundOk.call();
      value = !refundOk;
      await instance.setRefundOk(value, {from: App.currentAccount});
    } catch (error) {
      // debugger;
      let timestamp = App.getTimestamp();
      App.updateLog(timestamp, error.message);
    }
  },
  handleWithdraw: async (event) => {
    try {
      let instance = await App.setupDonationContract();
      let amount = await App.getBalance(); 
      await App.showCall("emptyBalance", async () => {
          await instance.emptyBalance({from: App.currentAccount});
          await App.showBalance(); // in case listening is not active.
        }
      );
      let receiver = App.currentAccount;
      let status = `Withdrawn ${amount} ETH to ${receiver}.`;  
      App.updateStatus(status);
    } catch (error) {
      let timestamp = App.getTimestamp();
      // use this to break the string into manageable length
      let stdmsg = 'Received 0.0244 ETH from 0x9785bebdC6F928Bc607175ac6D2d6Ac939C49c62.';
      let msg = wordwrap(error.message, stdmsg.length, "<br/>\n", true);
      App.updateLog(timestamp, msg);
    }    
  },
  hookConnectButton: () => {
    App.enableConnectButton();
  },
  hookEvents: () => {
      if (typeof ethereum == "undefined") {
        App.updateStatus("ethereum is not available. Functionality will not work.");
        return;
      }
      let connectListeners = ethereum.listeners(CONNECT);
      let disconnectListeners = ethereum.listeners(DISCONNECT);
      let accountsChangedListeners = ethereum.listeners(ACCOUNTSCHANGED);
      let chainChangedListeners = ethereum.listeners(CHAINCHANGED);

      // remove any existing listeners
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
    
  },
  isDonorModule: () => {
    let result = App.elementExists(BTN_SENDETH);
    return result;
  },
  isAdminModule: () => {
    let result = !App.isDonorModule();
    return result;
  },
  logAdminFeeChanged: async (data) => {
    try {
      let x = async function() {
        let tx = data.transactionHash;
        let blockNo = data.blockNumber;
        let block = await web3.eth.getBlock(blockNo);
        let timestamp = block.timestamp;
        let msg = App.getAdminFeeChangedMsg(data.args);
        App.updateAdminFee(data.args.amount);           
        App.updateLog(timestamp, msg);
      }
      await x();
    } catch (error) {
      let timestamp = App.getTimestamp();
      App.updateLog(timestamp, error);
    }    
  },
  logReceived: async (data) => {
    debugger;
    try {
      let sender = data.args.sender;
      let amount = web3.utils.fromWei(`${data.args.amount}`, "ether");
      // if the list element doesn't exist, then update the received donation on the status bar
      if (App.isDonorModule()) {
        App.updateStatus(`Thank you, ${sender} for your donation of ${amount} ether.`);
      } else {
        // since the list donations button exists, this must be the received page, so list it.
        let x = async function() {
          let tx = data.transactionHash;
          let blockNo = data.blockNumber;
          let block = await web3.eth.getBlock(blockNo);
          let timestamp = block.timestamp;
          // let sender = data.args.sender;
          // let amount = web3.utils.fromWei(`${data.args.amount}`, "ether");
          // let msg = `Received ${amount} ETH from ${sender}.`;            
          let msg = App.getReceivedETHMsg(data.args);
          App.updateLog(timestamp, msg);
        }
        await x();
      }
      await App.showBalance();
    } catch (error) {
      let timestamp = App.getTimestamp();
      App.updateLog(timestamp, "error showing log: " + error.message);
    }
  },
  logRefundOk: async (data) => {
    try {
      let x = async function() {
        let tx = data.transactionHash;
        let blockNo = data.blockNumber;
        let block = await web3.eth.getBlock(blockNo);
        let timestamp = block.timestamp;
        let yesno = (data.args.refundOk?"yes":"no");
        let msg = `Refund allowed: ${yesno}.`;
        App.updateRefundOk(data.args.refundOk);           
        App.updateLog(timestamp, msg);
      }
      await x();
    } catch (error) {
      let timestamp = App.getTimestamp();
      App.updateLog(timestamp, error);
    }
  },
  logWithdrawn: async (data) => {
    try {
      let amount = web3.utils.fromWei(`${data.args.amount}`, "ether");
      let x = async function() {
        let tx = data.transactionHash;
        let blockNo = data.blockNumber;
        let block = await web3.eth.getBlock(blockNo);
        let timestamp = block.timestamp;
        // let receiver = data.args.receiver;
        // let amount = web3.utils.fromWei(`${data.args.amount}`, "ether");
        // let msg = `Withdrawn ${amount} ETH to ${receiver}.`;
        let msg = App.getWithdrawnMsg(data.args);           
        App.updateLog(timestamp, msg);
      }
      await x();
      await App.showBalance();
    } catch (error) {
      let timestamp = App.getTimestamp();
      App.updateLog(timestamp, "error showing log: " + error.message);
    }
  },

  listenEvent: (event, name, handler) => {
    if (App.instances && typeof App.instances.Donation == "undefined") {
      // Don't listen if no instance available
      return;
    }
    let timestamp = App.getTimestamp();
    App.updateLog(timestamp, `Adding ${name} listener...`);
    let listeners = event.listeners(DATA);
    for(let listener in listeners) {
      if (listener == handler) {
        event.removeListener(DATA, handler);
      }
    }
    event.on(DATA, handler);
    timestamp = App.getTimestamp();
    App.updateLog(timestamp, `${name} listener added.`);
    let listeners2 = event.listeners(DATA);
    if (listeners != listeners2) {}
  },
  stopListening: (instance) => {
    let event;
    event = instance.Received();
    event.removeListener(DATA, App.logReceived);
    
    event = instance.Withdrawn();
    event.removeListener(DATA, App.logWithdrawn);

    event = instance.RefundStatusChanged();
    event.removeListener(DATA, App.logRefundOk);
    
    event = instance.AdminFeeChanged();
    event.removeListener(DATA, App.logAdminFeeChanged);
  },
  listenAdminFeeChanged: (instance) => {
    if (App.instances && typeof App.instances.Donation == "undefined") {
      // Don't listen if no instance available
      return;
    }
    const event = instance.AdminFeeChanged();
    App.listenEvent(event, "AdminFeeChanged", App.logAdminFeeChanged);
  },
  listenReceived: (instance) => {
    if (App.instances && typeof App.instances.Donation == "undefined") {
      // Don't listen if no instance available
      return;
    }
    const event = instance.Received();
    App.listenEvent(event, "Received", App.logReceived);
  },
  listenRefundOk: (instance) => {
    if (App.instances && typeof App.instances.Donation == "undefined") {
      // Don't listen if no instance available
      return;
    }
    const event = instance.RefundStatusChanged();
    App.listenEvent(event, "RefundStatusChanged", App.logRefundOk);
  },
  listenWithdrawn: (instance) => {
    if (App.instances && typeof App.instances.Donation == "undefined") {
      // Don't listen if no instance available
      return;
    }
    const event = instance.Withdrawn();
    App.listenEvent(event, "Withdrawn", App.logWithdrawn);
  },

  // define first so it's available to everyone
  updateStatus: (msg) => {
    let currentTime = new Date();
    let line = `${currentTime.timeNow()} - ${msg}`;
    console.log(line);
    let status = $("#status");
    status.text(line);
  },

  appendLog: (msg) => {
    let donationsLog = $(PNL_DONATIONS);
    donationsLog.append(msg);
  },
  clearLog: () => {
    let donationsLog = $(PNL_DONATIONS);
    donationsLog.empty(); // clear contents
  },
  getUpdateLog: (timestamp, msg) => {
    let currentTime = new Date(timestamp * 1000);
    let currentDate = `${currentTime.getFullYear()}-${(currentTime.getMonth()+1).toString().padStart(2, '0')}-${currentTime.getDate().toString().padStart(2, '0')}`
    let line = `${currentDate} ${currentTime.timeNow()} - ${msg}`;
    let result = `${line}<br>`;
    return result;
  },
  updateAdminFee: (adminFee) => { // takes adminFee in wei
    debugger;
    let amount = App.weiToEther(adminFee);
    $(LBL_ADMINFee).text(`${amount} ETH.`);
  },
  updateRefundOk: (refundOk) => {
    let value = refundOk?"yes": "no";
    $(LBL_REFUNDOK).text(value);
  },
  updateLog: (timestamp, msg) => {
    // let currentTime = new Date(timestamp * 1000);
    // let currentDate = `${currentTime.getFullYear()}-${(currentTime.getMonth()+1).toString().padStart(2, '0')}-${currentTime.getDate().toString().padStart(2, '0')}`
    // let line = `${currentDate} ${currentTime.timeNow()} - ${msg}`;
    // console.log(`${line}`);
    let line = App.getUpdateLog(timestamp, msg);
    // let donationsLog = $(PNL_DONATIONS);
    // donationsLog.append(line);
    App.appendLog(line);

    // auto-scrolling
    let donationsLog = $(PNL_DONATIONS);
    donationsLog.scrollTop(donationsLog.prop("scrollHeight")); // works if statusbar doesn't exist
    // $(window).scrollTop( $(window).scrollTop()+100 ); // works with or without status bar at the bottom   
  },
  handleRefundETH: async (event) => {
    try {
      let instance = await App.setupDonationContract();

      await App.showCall("refund", async () => {
        debugger;
        let amountToRefund = $(ED_ETHSENDVALUE).val().trim(); // reuse the send edit box.
        let amount = web3.utils.toHex( web3.utils.toWei(`${amountToRefund}`, "ether") );
        await instance.refund(amount, {from: App.currentAccount});
      });
     
    } catch (error) {
      App.updateStatus("refund error: " + error.message);
    }
    return true;   
  },
  handleSendETH: async (event) => {
    event.preventDefault();
    try {
      let instance = await App.setupDonationContract();

      await App.showCall("donateETH", async () => {
        let amountToSend = $(ED_ETHSENDVALUE).val().trim();
        let ETHdata = {
          from: App.currentAccount, 
          value: web3.utils.toHex( web3.utils.toWei(`${amountToSend}`, "ether") )
        };
        await instance.donateETH(ETHdata);
      });
     
    } catch (error) {
      App.updateStatus("donateETH error: " + error.message);
    }
    return true;   
  },

  setupDonationContract: async () => {
    if (App.contracts.Donation === undefined || App.instances === undefined || App.instances.Donation === undefined) {
      try {

        let data = App.DonationArtifact || await $.getJSON("Donation.json");
        if (App.DonationArtifact === undefined) {
          App.DonationArtifact = data; // setup the DonationArtifact
        }
        App.contracts.Donation = TruffleContract(data); // data is DonationArtifact
        App.contracts.Donation.setProvider(App.web3Provider);
        App.updateNetworkName(ethereum.chainId);
        let instance;
        if (App.instances == undefined || App.instances.Donation == undefined) {
          instance = await App.contracts.Donation.deployed();
          App.instances.Donation = instance;
        } else {
          instance = App.instances.Donation;
        }
        $(LBL_CONTRACT_ADDRESS).text(instance.address);
        debugger;
        if (App.isDonorModule()) {
          App.listenReceived(instance);
        }
        
        
        // Update owner address
        let owner = await instance.owner.call();
        $(LBL_OWNER_ADDRESS).text(owner);
        
        // Update admin fee
        let adminfee = await instance.adminFee.call();
        let refundOk = await instance.refundOk.call();
        
        App.updateAdminFee(adminfee);
        App.updateRefundOk(refundOk);
        
        // update balance
        await App.showBalance();
      } catch (error) {
        if (error == "Error: Donation has not been deployed to detected network (network/artifact mismatch)") {
          const NOT_DEPLOYED = "Not deployed.";
          $(LBL_OWNER_ADDRESS).text(NOT_DEPLOYED);
          $(LBL_CONTRACT_ADDRESS).text(NOT_DEPLOYED);
          $(LBL_CONTRACT_BALANCE).text(NOT_DEPLOYED);
          App.disableListDonationsButton();
          App.disableAdminButtons();
        }
        App.updateStatus(error);
        throw error;
      }
    }
    return App.instances.Donation;
  },

  updateConnectionStatus: () => {
    try {
      let connected = ethereum.isConnected();
      (connected ? App.displayConnectedChainId(ethereum.chainId): App.displayDisconnected());
    } catch (error) {
      // assumes no access to ethereum variable.
      if (error.name == "ReferenceError")
        App.updateStatus("No access to ethereum.");
    }
  },

  init: async () => {

    try {
      App.initWeb3Provider();

      let urlParams = new URLSearchParams(window.location.search);
      let auto = urlParams.has("auto");
      let disabled = (auto && (urlParams.get("auto") == "disabled"));
      if (!disabled) {
        App.updateStatus("Connecting automatically...");
        App.enableConnectButton();
        await App.requestAccounts();
        App.updateConnectionStatus();
        App.hookEvents();
        if (App.elementExists(BTN_LISTDONATIONS)) {
          App.enableListDonationsButton();
          await App.checkAdminButtons();
        } else {
          if (ethereum.isConnected()) {
            App.disableDonateButton();
            // enable the donate button and refund button
            App.enableDonateButton();
            App.enableRefundButton();
          }
        }
      }
    } catch (error) {
      // likely a logic error, or forgot to handle something
      App.updateStatus(error);
    }
    return true;
  },

  handleConnect: async (event) => {
    await App.showCall("Connect", async () => {
      try { 
        await App.initWeb3();
        await App.setupDonationContract();
        // See https://github.com/MetaMask/metamask-extension/issues/8990#issuecomment-658985565
        // Switch accounts 
        await window.ethereum.request({
          method: "wallet_requestPermissions",
          params: [
            {
              eth_accounts: {}
            }
          ]
        });
      } catch (error) {
        App.updateStatus(error.message);
      }  
    });    
    return true;
  },

  initWeb3Provider: () => {
    if (App.web3Provider == null) {   
      if (window.ethereum) {
        App.web3Provider = window.ethereum;
      } else if (window.web3) {
        App.web3Provider = window.web3.currentProvider;
      } else {
        App.web3Provider = new Web3.providers.HttpProvider("http://localhost:7545");
      }
      web3 = new Web3(App.web3Provider);
    }
  },

  initWeb3: async () => {
      try {

        await App.requestAccounts();
        App.hookEvents();

      } catch (error) {       
        App.updateStatus("User denied account access: " + error);     
      }   
  },

  showCall: async (name, fn) => {
    App.updateStatus(`Calling ${name}...`);
    try {
      await fn();
    } finally {
      App.updateStatus(`Call to ${name} completed.`);
    }
  }

};

// shorthand for $(document).ready
// $(function() {


//   // doesn't work on Firefox, but works on Chrome
//   $(window).on("load", async function() {
//     console.log("Initializing app...");
//     await App.init();
//   });

// });

// https://stackoverflow.com/questions/6811929/why-does-firefox-5-ignore-document-ready
window.addEventListener('pageshow', async () =>{
    console.log("Initializing app...");
    await App.init();
  }, false);