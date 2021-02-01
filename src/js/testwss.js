// event message names
const CLICK = "click";
const EVENT_NAME = "data";
const DISABLED = "disabled";

let infuraInfo;

// Web3 events
const CHAINCHANGED = "chainChanged";
const ACCOUNTSCHANGED = "accountsChanged";
const CONNECT = "connect";
const DISCONNECT = "disconnect";

function constructEventSignatureInfoType(eventInfo) {
    // "Received(address,uint256,uint256)"
    let _typeInfoArray = eventInfo.inputs;
    let topic = eventInfo.name + "(";
    let typesArray = [];
    for(let i=0; i<_typeInfoArray.length; i++) {
        let typeInfo = _typeInfoArray[i];
        let result = {
            type: typeInfo.internalType, 
            name: typeInfo.name, 
            indexed: typeInfo.indexed
        };
        typesArray.push(typeInfo);
        topic = topic + typeInfo.type;
        if (i < _typeInfoArray.length-1) {
            topic = topic + ","
        }    
    }
    topic = topic + ")";    
    let result = {topic: topic, typesArray: typesArray};
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

let App = {
  init: async() => {
    console.log("And we're running!");
  },
  initEventReaders: async() => {
    let data = App.DonationArtifact || await $.getJSON("Donation.json");
    if (App.DonationArtifact == undefined || App.DonationArtifact == null) {
        let instance = TruffleContract(data);
        App.DonationArtifact = instance;
        let dict = instance.events;
        debugger;
        let infoType = lookupEventSignatureInfoType("AdminFeeChanged", dict);
        for(let key in dict) {
            let value = dict[key];
            console.log(`${value.name}: `, value);
            console.log("inputs: ", value.inputs);
            constructEventSignature(value);
        }
    }
  },
};

window.addEventListener('pageshow', async () =>{
    console.log("Initializing app...");
    await App.init();
  }, false
);

window.addEventListener('DOMContentLoaded', async (event) => {
    console.log('DOM fully loaded and parsed');
    await App.initEventReaders();
});