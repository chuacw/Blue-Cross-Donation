/*
References: 
https://medium.com/better-programming/ethereum-dapps-how-to-listen-for-events-c4fa1a67cf81
https://bitsofco.de/calling-smart-contract-functions-using-web3-js-call-vs-send/

Ethereum events: 
https://docs.metamask.io/guide/ethereum-provider.html#events
https://docs.metamask.io/guide/rpc-api.html
https://eips.ethereum.org/EIPS/eip-1193

Author: chuacw, Singapore, Singapore
Date: 23 Jan - 2 Feb 2021
*/
"strict mode"; 

const BTN_CONNECT = "#btnConnect";

const BTN_DONATE_ETH = "#btnDonateETH";
const BTN_REFUNDETH = "#btnRefundETH";
const ED_ETHSENDVALUE = "#edETHSendValue";

const BTN_LISTEN_EVENTS = "#btnListenEvents";
const BTN_SET_ADMIN_FEE = "#btnSetAdminFee";
const ED_ADMINFEE = "#edAdminFee";
const BTN_WITHDRAW = "#btnWithdraw";
const BTN_TOGGLE_REFUND = "#btnToggleRefund";

const CLASS_BLINKER = ".btn-blinkme";

const PNL_DONATIONS = "#donationsPanel";
const LBL_WALLET_ADDRESS = "#WalletAddressValue";
const LBL_CONTRACT_ADDRESS = "#ContractAddressValue";
const LBL_CONTRACT_BALANCE = "#ContractBalanceValue";
const LBL_OWNER_ADDRESS = "#OwnerAddressValue";
const LBL_NETWORK_NAME = "#NetworkNameValue";
const LBL_ADMINFee = "#AdminFeeValue";
const LBL_REFUNDOK = "#RefundOkValue";

const STATUSBAR = "#status";

// event message names
const CLICK = "click";
const EVENT_NAME = "data";
const DISABLED = "disabled";

// Web3 events
const CHAINCHANGED = "chainChanged";
const ACCOUNTSCHANGED = "accountsChanged";
const CONNECT = "connect";
const DISCONNECT = "disconnect";

const ED_NEW_OWNER_ADDRESS="#edNewAddress";
const BTN_CHANGE_OWNER="#btnChangeOwner";

const DIAGNOSTICS = false;

let blinkerID = 0, infuraInfo;

function blinker() {
  $(BTN_LISTEN_EVENTS).fadeOut(500);
  $(BTN_LISTEN_EVENTS).fadeIn(500);
}
function startBlinker() {
  if (blinkerID == 0) {
    blinkerID = setInterval(blinker, 1000);
  }
}
function stopBlinker() {
  if (blinkerID != 0) {
    clearInterval(blinkerID);
  }
  blinkerID = 0;
}

const compareAddress = (addr1, addr2) => {
  let result = false;
  if (addr1 && addr2) {
    let _addr1 = addr1.toLowerCase();
    let _addr2 = addr2.toLowerCase();
    result = _addr1 == _addr2;
  }
  return result;
}

const sleep = (ms) => {
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

// do not use arrow syntax for this!
Date.prototype.timeNow = function() {
  let H = this.getHours(); 
  let M = this.getMinutes();    
  let S = this.getSeconds(); 
  let hhprefix = ""; // (H>1?((H < 10)?"0":""):"");
  let hh = (H>12)?(H-12):(H>1?H:12);
  let mm = ((M < 10)?"0":"") + M;
  let ssprefix = ((S < 10)?"0":"");
  let ampm = (H>=12)?"PM":"AM";
  let result = hhprefix + hh + ":" + mm + ":" + ssprefix + S + " " + ampm;
  return result; 
};

function constructEventSignatureInfoType(eventInfo) {
  // "Received(address,uint256,uint256)"
  let _typeInfoArray = eventInfo.inputs;
  // Oddly, some events do not have a signature defined. 
  // See the Withdrawn event
  let signatureUndefined = (typeof eventInfo.signature == "undefined");
  let rawSignature, topicValue;
  if (signatureUndefined) {
    console.error(`${eventInfo.name} do not have an event signature.`);
    rawSignature = eventInfo.name + "(";
  }
  let typesArrayValue = [];
  for(let i=0; i<_typeInfoArray.length; i++) {
      let typeInfo = _typeInfoArray[i];
      let result = {
          type: typeInfo.internalType, 
          name: typeInfo.name, 
          indexed: typeInfo.indexed
      };
      typesArrayValue.push(result);
      if (signatureUndefined) {
        rawSignature = rawSignature + typeInfo.type;
        if (i < _typeInfoArray.length-1) {
            rawSignature = rawSignature + ","
        }    
      }
  }
  if (signatureUndefined) { 
    rawSignature = rawSignature + ")";
    topicValue = web3.eth.abi.encodeEventSignature(rawSignature); 
  } else {
    topicValue = eventInfo.signature;
  }  
  let result = {topic: topicValue, typesArray: typesArrayValue};
  return result;
}

function lookupEventSignatureInfoType(name, dict) {
  let result;
  for (let key in dict) {
      let value = dict[key];
      if (value.name == name) {
          result = constructEventSignatureInfoType(value);
          break;
      }
  }
  return result;
}

function getAllTopics(allTopicTypes) {
  let result = [];
  for (let i=0; i<allTopicTypes.length; i++) {
    let topicTypes = allTopicTypes[i];
    result.push(topicTypes.topic);
  }
  return result;
}

let App = {
  web3Provider: null,
  contracts: {},
  instances: {},
  wssProvider: "wss://localhost:8545",
  web3wss: {},

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

  getErrorMsg: (error) => {
    if (typeof error == "object") {
      msg = error.message;
    } else {
      msg = error;
    }
    return msg;    
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
  getOwnerChangedMsg: (event) => {
    let msg = `New owner is: ${event.newOwner}`;
    return msg;
  },
  getReceivedETHMsg: (event) => {
    let sender = event.sender;
    let amount = web3.utils.fromWei(`${event.amount}`, "ether");
    let msg = `Received ${amount} ETH from ${sender}.`;
    return msg;
  },
  getRefundedMsg: (event) => {
    // debugger;
    let receiver = event.receiver; // wrong signature names can cause an exception!!!
    let amount = web3.utils.fromWei(`${event.amount}`, "ether");
    let msg = `Refunded ${amount} ETH to ${receiver}.`;
    return msg;
  },
  getRefundOkMsg: (event) => {
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
    App.updateStatus(`Connected to the Ethereum network id: ${chainName}.`);
  },
  displayDisconnected: () => {
    App.updateStatus("Disconnected.");
  },
  getChainName: (_chainId) => {
    let chainName = "";
    try {    
      let chainId = parseInt(_chainId);
      switch(chainId) {
        case 1: 
          chainName = "mainnet";
          break; 
        case 3: 
          chainName = "ropsten";
          break;
        case 4: 
          chainName = "rinkeby";
          break;
        case 5: 
          chainName = "goerli";
          break;
        case 42: 
          chainName = "kovan";
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
    App.disableButton(BTN_DONATE_ETH);
  },
  enableDonateButton: () => {
    App.disableDonateButton();
    App.enableButton(BTN_DONATE_ETH, App.handleSendETH);
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
    let owner = await instance.owner.call();
    compareAddress(App.currentAccount, owner) ? App.enableListEventsButton(): App.disableListDonationsButton();   
  },
  disableListDonationsButton: () => {
    App.disableButton(BTN_LISTEN_EVENTS);
  },  
  enableListEventsButton: () => {
    App.enableButton(BTN_LISTEN_EVENTS, App.handleListenEvents);
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
    App.enableChangeOwnerButton();
    App.enableChangeAddressInput();
  },
  disableAdminButtons: () => {
    App.disableWithdrawButton();
    App.disableSetAdminFeeButton();
    App.disableToggleRefundButton();
    App.disableChangeOwnerButton();
    App.disableChangeAddressInput();
  },
  checkWithdrawButton: async () => {
    let instance = await App.setupDonationContract();
    let owner = await instance.owner();
    compareAddress(App.currentAccount, owner) ? App.enableWithdrawButton(): App.disableWithdrawButton();
  },
  enableChangeOwnerButton: () => {
    App.enableButton(BTN_CHANGE_OWNER, App.handleChangeOwner);    
  },
  enableChangeAddressInput: () => {
    $(ED_NEW_OWNER_ADDRESS).removeAttr(DISABLED);
  },
  disableChangeOwnerButton: () => {
    App.disableButton(BTN_CHANGE_OWNER);
  },
  disableChangeAddressInput: () => {
    $(ED_NEW_OWNER_ADDRESS).attr(DISABLED, true);
  },

  disableWithdrawButton: () => {
    App.disableButton(BTN_WITHDRAW);
  },
  enableWithdrawButton: () => {
    App.enableButton(BTN_WITHDRAW, App.handleWithdraw);
  },
  disableToggleRefundButton: () => {
    App.disableButton(BTN_TOGGLE_REFUND);
  },
  enableToggleRefundButton: () => {
    App.enableButton(BTN_TOGGLE_REFUND, App.handleToggleRefund);
  },
  disableSetAdminFeeButton: () => {
    App.disableButton(BTN_SET_ADMIN_FEE);
  },
  enableSetAdminFeeButton: () => {
    App.enableButton(BTN_SET_ADMIN_FEE, App.handleSetAdminFee);
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
      let msg = App.getErrorMsg(error);
      App.updateStatus(msg);
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
    try {
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
        App.enableListEventsButton();
      }
      stopBlinker();
      startBlinker();
    } catch (error) {
      let msg = App.getErrorMsg(error);
      App.updateStatus(msg);
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
      let amount = await web3.eth.getBalance(instance.address);
      balance = web3.utils.fromWei(`${amount}`, "ether");
    } catch (error) {
      balance = "Unable to retrieve contract balance.";
      App.updateStatus(error);
    }
    return balance;
  },
  updateBalance: async () => {
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
      let msg = App.getErrorMsg(error);
      App.updateStatus("Unable to request accounts: " + msg);
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
        let owner = await instance.owner.call();
        $(LBL_OWNER_ADDRESS).text(owner);
        await App.updateBalance();
      }
      await App.checkAdminButtons();
    }
  },
  displayAllLogs: async (address, topicWithFnArray) => {
    let dict = new Object();
    for (let i=0; i<topicWithFnArray.length; i++) {
      let element = topicWithFnArray[i];
      let key = element.topic.toLowerCase();
      dict[key] = element;
      if (DIAGNOSTICS) {
        console.log(`key: ${key}`);
      }
    }
    let logs = await web3.eth.getPastLogs({fromBlock: 0, toBlock: "latest",
      address: address});
    for (let i=0; i<logs.length; i++) {
      let log = logs[i];
      let data = log.data;
      let topicKey = log.topics[0].toLowerCase();
      if (DIAGNOSTICS) {
        console.log(`log topic: ${topicKey}`);
      }
      let element = dict[topicKey];
      
      if (typeof element == "undefined") {
        if (DIAGNOSTICS) {
          console.error(`unknown topic: ${topicKey}`);
        }
        continue; // unknown event
      }
      let typesArray = element.typesArray;
      let decodedLog = web3.eth.abi.decodeLog(typesArray, data, log.topics.slice(1));
      let blockNo = log.blockNumber;
      let block = await web3.eth.getBlock(blockNo);
      let timestamp = block.timestamp;
      let fn = element.handler;
      try {
        let msg = fn(decodedLog);
        App.updateLog(timestamp, msg);
      } catch (error) {
        let msg = App.getErrorMsg(error);
        let timestamp = App.getTimestamp();
        App.updateLog(timestamp, "Error during decoding: " + msg);
      }
    }
  },
  displayLog: async (address, topic, typesArray, fn) => {
    let logs = await web3.eth.getPastLogs({fromBlock: 0, toBlock: 'latest', address: address, 
      topics: [topic]});
    // See https://howchoo.com/code/learn-the-slow-and-fast-way-to-append-elements-to-the-dom
    for (let i=0; i<logs.length; i++) {
      let log = logs[i];
      let data = log.data;
        
      let decodedLog = web3.eth.abi.decodeLog(typesArray, data, log.topics.slice(1));
      let blockNo = log.blockNumber;
      let block = await web3.eth.getBlock(blockNo);
      let timestamp = block.timestamp;

      try {
        let msg = fn(decodedLog);
        App.updateLog(timestamp, msg);
      } catch (error) {
        let msg = App.getErrorMsg(error);
        let timestamp = App.getTimestamp();
        App.updateLog(timestamp, "Error during decoding: " + msg);
      }
    }
    
  },
  handleChangeOwner: async () => {


    try {
      await App.showCall("change owner", async () => {
        let instance = await App.setupDonationContract();
        let newOwnerAddress = $(ED_NEW_OWNER_ADDRESS).val(); // get the HTML input
        let isAddress = web3.utils.isAddress(newOwnerAddress);
        if (!isAddress) {
          throw `${newOwnerAddress} is not a valid address!`;
        }
        await instance.changeOwner(newOwnerAddress, {from: App.currentAccount});
      });
    } catch (error) {
      let timestamp = App.getTimestamp();
      let msg = App.getErrorMsg(error);
      App.updateLog(timestamp, "Error during changing owner: " + msg);
    }
  },
  handleListenEvents: async (event) => {
    // Handles the Start listening to events button
        stopBlinker();
        App.updateStatus("Listening for events...");
        let timestamp = App.getTimestamp();
        App.appendLog("-- start of historical events -- <br/>")
        let instance = await App.setupDonationContract();
        // list all previous donations
        let address = instance.address;
        let topic, logs;
      
        // https://ethereum.stackexchange.com/questions/87653/how-to-decode-log-event-of-my-transaction-log
        let typesArray, topicTypes;
        let allTopicTypes = []; let events = App.contracts.Donation.events;
        let AdminFeeTypes = lookupEventSignatureInfoType("AdminFeeChanged", events);
        let AdminOwnerChangedTypes = lookupEventSignatureInfoType("OwnerChanged", events);
        let ReceivedTypes = lookupEventSignatureInfoType("Received",  events);
        let RefundedTypes = lookupEventSignatureInfoType("Refunded", events);
        let RefundStatusChangedTypes = lookupEventSignatureInfoType("RefundStatusChanged", events);
        let WithdrawnTypes1 = lookupEventSignatureInfoType("Withdrawn", events);       
        let AdminFeeChangedHandler = {
          topic: AdminFeeTypes.topic, 
          typesArray: AdminFeeTypes.typesArray,
          handler: (decodedLog) => {
            let msg = App.getAdminFeeChangedMsg(decodedLog);
            return msg;
          }
        };
        let OwnerChangedHandler = {
          topic: AdminOwnerChangedTypes.topic, 
          typesArray: AdminOwnerChangedTypes.typesArray,
          handler: (decodedLog) => {
            let msg = App.getOwnerChangedMsg(decodedLog);
            return msg;
          }
        };
        let ReceivedHandler = {
          topic: ReceivedTypes.topic,
          typesArray: ReceivedTypes.typesArray,
          handler: (decodedLog) => {
            let msg = App.getReceivedETHMsg(decodedLog);
            return msg;
          }
        };
        let RefundedHandler = {
          topic: RefundedTypes.topic,
          typesArray: RefundedTypes.typesArray,
          handler: (decodedLog) => {
            let msg = App.getRefundedMsg(decodedLog);
            return msg;
          } 
        };
        let RefundStatusChangedHandler = {
          topic: RefundStatusChangedTypes.topic,
          typesArray: RefundStatusChangedTypes.typesArray,
          handler: (decodedLog) => {
            let msg = App.getRefundOkMsg(decodedLog);           
            return msg;
          } 
        };
        let WithdrawnHandler1 = {
          topic: WithdrawnTypes1.topic,
          typesArray: WithdrawnTypes1.typesArray,
          handler: (decodedLog) => {
            let msg = App.getWithdrawnMsg(decodedLog);
            return msg;
          }
        };
        let WithdrawnHandler2 = {
          topic: web3.eth.abi.encodeEventSignature("Withdrawn(address,uint256,uint256)"),
          typesArray: [
            {type: 'address', name: 'receiver', indexed: true}, 
            {type: 'uint256', name: 'amount'},
            {type: "uint256", name: "count"}
          ],
          handler: (decodedLog) => {
            // debugger;
            let msg = App.getWithdrawnMsg(decodedLog);
            return msg;
          } 
        };
        let topicHandlers = [AdminFeeChangedHandler, OwnerChangedHandler, ReceivedHandler, 
          RefundedHandler, RefundStatusChangedHandler, WithdrawnHandler1, WithdrawnHandler2
        ];
        await App.displayAllLogs(address, topicHandlers);
/* 
        // topic = web3.eth.abi.encodeEventSignature("Received(address,uint256,uint256)");
        // typesArray = [
        //   {type: 'address', name: 'sender', indexed: true}, 
        //   {type: 'uint256', name: 'amount'},
        //   {type: 'uint256', name: 'count'}
        // ];
        topicTypes = lookupEventSignatureInfoType("Received",  App.contracts.Donation.events);
        // if (topic != topicTypes.topic) {
        //   console.error("topic doesn't match!!!");
        // }        
        await App.displayLog(address, topicTypes.topic, topicTypes.typesArray, (decodedLog) => {
          let msg = App.getReceivedETHMsg(decodedLog);
          return msg;
        });
*/
        App.appendLog("-- end of historical events --<br/>")

        // now start listening to events: Received,  Withdraw, Refund, etc..
        let listenToEvents = [
          App.listenAdminFeeChanged,
          App.listenOwnerChanged,
          App.listenReceived,
          App.listenRefunded,
          App.listenRefundOk,
          App.listenWithdrawn
        ];
        debugger;
        for(let listenToEvent of listenToEvents) {
          try {
            listenToEvent(instance);
          } catch (error) {
            let msg = App.getErrorMsg(error);
            App.updateStatus(msg);
          }
        }
  },
  handleSetAdminFee: async () => {
    await App.showCall("Set Admin Fee", async () => {
      try { 
        let instance = await App.setupDonationContract();
        let amount = $(ED_ADMINFEE).val().trim();
        let adminFee = web3.utils.toHex( web3.utils.toWei(`${amount}`, "ether") );
        await instance.setAdminFee(adminFee, {from: App.currentAccount});
      } catch (error) {
        let msg = App.getErrorMsg(error);
        App.updateStatus(msg);
        throw msg;
      }
    });      
  },
  handleToggleRefund: async () => {
    try {
      let instance = await App.setupDonationContract();
      let refundOk = await instance.refundOk.call();
      value = !refundOk;
      await instance.setRefundOk(value, {from: App.currentAccount});
    } catch (error) {
      // debugger;
      let msg = App.getErrorMsg(error);
      App.updateStatus(msg);
      let timestamp = App.getTimestamp();
      App.updateLog(timestamp, msg);
    }
  },
  handleWithdraw: async (event) => {
    try {
      let instance = await App.setupDonationContract();
      let receiver = App.currentAccount;
      let amount = await App.getBalance();
      let update = false;
      const event = instance.Withdrawn();
      event.once(EVENT_NAME, (data) => {
        // Withdraw event
        // debugger;
        update = true;
        amount = data.args.amount;
        receiver = data.args.receiver;
      }); 
      await App.showCall("emptyBalance", async () => {
          await instance.emptyBalance({from: App.currentAccount});
          await App.updateBalance(); // in case listening is not active.
        }
      );
      if (update) { 
        let status = `Withdrawn ${amount} ETH to ${receiver}.`;  
        App.updateStatus(status);
      }
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

      // event listeners, to listen for incoming events

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
    let result = App.elementExists(BTN_DONATE_ETH);
    return result;
  },
  isAdminModule: () => {
    let result = !App.isDonorModule();
    return result;
  },
  logAdminFeeChanged: async (data) => {
    // debugger;
    try {
      let x = async function() {
        let tx = data.transactionHash;
        let blockNo = data.blockNumber;
        let block = await web3.eth.getBlock(blockNo);
        let timestamp = block.timestamp;
        let msg = App.getAdminFeeChangedMsg(data.args);
        App.updateAdminFee(data.args.amount); // don't update current          
        App.updateLog(timestamp, msg);
      }
      await x();
    } catch (error) {
      let timestamp = App.getTimestamp();
      let msg = App.getErrorMsg(error);
      App.updateStatus(msg);
      App.updateLog(timestamp, msg);
    }    
  },
  logOwnerChanged:async (data) => {
    debugger;
    try {
      let x = async function() {
        let tx = data.transactionHash;
        let blockNo = data.blockNumber;
        let block = await web3.eth.getBlock(blockNo);
        let timestamp = block.timestamp;
        let msg = App.getOwnerChangedMsg(data.args);
   
        App.updateLog(timestamp, msg);

        delete App.instances.Donation; // update owner by deleting the current instance
        await App.setupDonationContract();
      }
      await x();
    } catch (error) {
      let msg = App.getErrorMsg(error);
      App.updateStatus(msg);
      let timestamp = App.getTimestamp();
      App.updateLog(timestamp, msg);
    }    
  },
  logReceived: async (data) => {
    // debugger;
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
          let msg = App.getReceivedETHMsg(data.args);
          App.updateLog(timestamp, msg);
        }
        await x();
      }
      // update contract balance
      await App.updateBalance();
    } catch (error) {
      let msg = App.getErrorMsg(error);
      App.updateStatus(msg);
      let timestamp = App.getTimestamp();
      App.updateLog(timestamp, "error showing log: " + msg);
    }
  },
  logRefunded: async (data) => {
    // debugger;
    try {
      let x = async function() {
        let tx = data.transactionHash;
        let blockNo = data.blockNumber;
        let block = await web3.eth.getBlock(blockNo);
        let timestamp = block.timestamp;
        let msg = App.getRefundedMsg(data.args);
        App.updateLog(timestamp, msg);
      }
      await x();
    } catch (error) {
      let msg = App.getErrorMsg(error);
      App.updateStatus(msg);
      let timestamp = App.getTimestamp();
      App.updateLog(timestamp, msg);
    }
  },
  logRefundOk: async (data) => {
    // debugger;
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
      let msg = App.getErrorMsg(error);
      App.updateStatus(msg);
      let timestamp = App.getTimestamp();
      App.updateLog(timestamp, msg);
    }
  },
  logWithdrawn: async (data) => {
    // debugger;
    try {
      let amount = web3.utils.fromWei(`${data.args.amount}`, "ether");
      let x = async function() {
        let tx = data.transactionHash;
        let blockNo = data.blockNumber;
        let block = await web3.eth.getBlock(blockNo);
        let timestamp = block.timestamp;
        let msg = App.getWithdrawnMsg(data.args);           
        App.updateLog(timestamp, msg);
      }
      await x();
      await App.updateBalance();
    } catch (error) {
      let msg = App.getErrorMsg(error);
      App.updateStatus(msg);      
      let timestamp = App.getTimestamp();
      App.updateLog(timestamp, "error showing log: " + msg);
    }
  },

  listenEvent: (event, name, handler) => {
    if (App.instances && typeof App.instances.Donation == "undefined") {
      // Don't listen if no instance available
      return;
    }
    let timestamp = App.getTimestamp();
    if (DIAGNOSTICS) {App.updateLog(timestamp, `Adding ${name} listener...`);} else {
      console.log(`Adding ${name} listener...`);
    }
    let listeners = event.listeners(EVENT_NAME);
    for(let listener in listeners) {
      if (listener == handler) {
        event.removeListener(EVENT_NAME, handler);
      }
    }
    event.on(EVENT_NAME, handler);
    timestamp = App.getTimestamp();
    if (DIAGNOSTICS) {App.updateLog(timestamp, `${name} listener added.`);} else {
      console.log(`${name} added.`);
    }
    let listeners2 = event.listeners(EVENT_NAME);
    if (listeners != listeners2) {}
  },
  stopListening: (instance) => {
    let event;

    event = instance.Refunded();
    event.removeListener(EVENT_NAME, App.logRefunded);

    event = instance.Received();
    event.removeListener(EVENT_NAME, App.logReceived);
    
    event = instance.Withdrawn();
    event.removeListener(EVENT_NAME, App.logWithdrawn);

    event = instance.RefundStatusChanged();
    event.removeListener(EVENT_NAME, App.logRefundOk);
    
    event = instance.AdminFeeChanged();
    event.removeListener(EVENT_NAME, App.logAdminFeeChanged);
  },
  listenAdminFeeChanged: (instance) => {
    if (App.instances && typeof App.instances.Donation == "undefined") {
      // Don't listen if no instance available
      return;
    }
    const event = instance.AdminFeeChanged();
    App.listenEvent(event, "AdminFeeChanged", App.logAdminFeeChanged);
  },
  listenOwnerChanged: (instance) => {
    if (App.instances && typeof App.instances.Donation == "undefined") {
      // Don't listen if no instance available
      return;
    }
    const event = instance.OwnerChanged();
    App.listenEvent(event, "OwnerChanged", App.logOwnerChanged);
  },
  listenReceived: (instance) => {
    if (App.instances && typeof App.instances.Donation == "undefined") {
      // Don't listen if no instance available
      return;
    }
    const event = instance.Received();
    App.listenEvent(event, "Received", App.logReceived);
  },
  listenRefunded: (instance) => {
    if (App.instances && typeof App.instances.Donation == "undefined") {
      // Don't listen if no instance available
      return;
    }
    const event = instance.Refunded();
    App.listenEvent(event, "Refunded", App.logRefunded);
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
    let status = $(STATUSBAR);
    status.text(line);
  },

  // log related functions
  appendLog: (msg) => {
    let donationsLog = $(PNL_DONATIONS);
    donationsLog.append(msg);
    donationsLog.scrollTop(donationsLog.prop("scrollHeight")); // works if statusbar doesn't exist
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
  updateLog: (timestamp, msg) => {
    let line = App.getUpdateLog(timestamp, msg);
    App.appendLog(line);

    // auto-scrolling
    let donationsLog = $(PNL_DONATIONS);
    donationsLog.scrollTop(donationsLog.prop("scrollHeight")); // works if statusbar doesn't exist
  },

  updateAdminFee: (adminFee) => { // takes adminFee in wei
    let amount = App.weiToEther(adminFee);
    $(LBL_ADMINFee).text(`${amount} ETH`);
  },
  updateRefundOk: (refundOk) => {
    let value = refundOk?"yes": "no";
    $(LBL_REFUNDOK).text(value);
  },
  updateOwner: (address) => {
    $(LBL_OWNER_ADDRESS).text(address);
  },
  handleRefundETH: async (event) => {
    try {
      let instance = await App.setupDonationContract();

      await App.showCall("refund", async () => {
        let amountToRefund = $(ED_ETHSENDVALUE).val().trim(); // reuse the send edit box.
        let amount = web3.utils.toHex( web3.utils.toWei(`${amountToRefund}`, "ether") );
        await instance.refund(amount, {from: App.currentAccount});
      });
     
    } catch (error) {
      let msg = App.getErrorMsg(error);
      App.updateStatus("refund error: " + msg);
    }
    return true;   
  },
  handleSendETH: async (event) => {
    event.preventDefault();
    try {
      let instance = await App.setupDonationContract();

      await App.showCall("donateETH", async () => {
        let amountToSend = $(ED_ETHSENDVALUE).val().trim();
        let ethData = {
          from: App.currentAccount, 
          value: web3.utils.toHex( web3.utils.toWei(`${amountToSend}`, "ether") )
        };
        await instance.donateETH(ethData);
      });
     
    } catch (error) {
      let msg = App.getErrorMsg(error);
      App.updateStatus("donateETH error: " + msg);
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
        await App.updateBalance();
        App.checkAdminButtons();
      } catch (error) {
        if (error == "Error: Donation has not been deployed to detected network (network/artifact mismatch)") {
          const NOT_DEPLOYED = "Not deployed.";
          $(LBL_OWNER_ADDRESS).text(NOT_DEPLOYED);
          $(LBL_CONTRACT_ADDRESS).text(NOT_DEPLOYED);
          $(LBL_CONTRACT_BALANCE).text(NOT_DEPLOYED);
          App.disableListDonationsButton();
          App.disableAdminButtons();
        }
        stopBlinker();
        let msg = App.getErrorMsg(error);
        App.updateStatus(msg);
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
      if (typeof error.name != "undefined" && error.name == "ReferenceError") {
        App.updateStatus("No access to ethereum.");
      } else {
        let msg = App.getErrorMsg(error);
        App.updateStatus(msg);
        let timestamp = App.getTimestamp();
        App.updateLog(timestamp, msg)
      }
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

        // remind user to listen to events
        startBlinker();

        if (App.elementExists(BTN_LISTEN_EVENTS)) {
          App.enableListEventsButton();
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
      let msg = App.getErrorMsg(error);
      App.updateStatus(msg);
      let timestamp = App.getTimestamp();
      App.updateLog(timestamp, msg);
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
        let msg = App.getErrorMsg(error);
        App.updateStatus(msg);
        let timestamp = App.getTimestamp();
        App.updateLog(timestamp, msg);
        throw msg;
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
      // web3 = new Web3(Web3.providers.WebsocketProvider
    }
  },

  initWeb3: async () => {
      try {

        await App.requestAccounts();
        App.hookEvents();

      } catch (error) {
        let msg = App.getErrorMsg(error);
        App.updateStatus("User denied account access: " + msg);
        let timestamp = App.getTimestamp();
        App.updateLog(timestamp, msg);     
      }   
  },

  showCall: async (name, fn) => {
    App.updateStatus(`Calling ${name}...`);
    let msg = "";
    try {
      try {
        await fn();
      } catch (error) {
        msg = App.getErrorMsg(error);
        let timestamp = App.getTimestamp();
        App.updateLog(timestamp, msg);
      }
    } finally {
      App.updateStatus(`Call to ${name} completed. ${msg}`);
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
  }, false
);