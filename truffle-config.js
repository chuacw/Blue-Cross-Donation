const HDWalletProvider = require('@truffle/hdwallet-provider');
const configData = require("./.secret.json");
const infuraKey = configData.InfuraProjectID; // this is Infura Project ID
const mnemonic = configData.mnemonic;

module.exports = {
  // see https://ethereum.stackexchange.com/questions/19641/how-to-set-the-timeout-for-truffle-tests-before-block
  mocha: {
    enableTimeouts: false
  },
  networks: {
    rinkeby: {
      // key is currently only configured for Rinkeby. To make it work on Kovan, add another key
      provider: () => new HDWalletProvider(mnemonic, `https://rinkeby.infura.io/v3/${infuraKey}`), 
      network_id: 4,
      gas: 3000000,
      confirmations: 2,
      timeoutBlocks: 200,
      skipDryRun: true      
    },
    development: {
      host: "127.0.0.1",
      port: 7545,
      network_id: "*", // Match any network id
      websockets: true
    },
    develop: {
      port: 8545
    }
  },
  compilers: {
    solc: {
      version: "0.7.5",    // Fetch exact version from solc-bin (default: truffle's version)
    }
  },
  plugins: [
    'truffle-plugin-verify'
  ],
  api_keys: {
    etherscan: `${configData.EtherscanAPI}`
  }  
};
