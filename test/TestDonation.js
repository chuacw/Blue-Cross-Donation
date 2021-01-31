// See: https://ethereum.stackexchange.com/a/58483/17144
const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:7545'));

const Donation = artifacts.require("Donation");

contract("Donation", async (accounts) => {

// common functions
    let donateETH = async (instance, account, amount) => {
      let transaction = await instance.donateETH({from: account, 
        value: web3.utils.toHex( web3.utils.toWei(`${amount}`, "ether") )});
      return transaction;
    };

    let refundETH = async (instance, account, amount) => {
      let weiAmount = web3.utils.toHex( web3.utils.toWei(`${amount}`, "ether") );
      let transaction = await instance.refund(weiAmount, {from: account});
      return transaction;
    };

    let getAdminFee = async (instance) => {
      adminFeeWei = await instance.adminFee.call();
      let result = web3.utils.fromWei(`${adminFeeWei}`, "ether");
      return result;
    };

    let setAdminFee = async (instance, account, amount) => {
      let weiAmount = web3.utils.toHex( web3.utils.toWei(`${amount}`, "ether") );
      let transaction = await instance.setAdminFee(weiAmount, {from: account});
      return transaction;
    };

    let getBalance = async (instance, account) => {
      let balanceWei = await instance.donations.call(account);
      let balance = web3.utils.fromWei(`${balanceWei}`, "ether");
      return balance;
    };

    let getRefundOk = async (instance) => {
      result = await instance.refundOk.call();
      return result;
    };

    let sleep = async (ms) => {
      return new Promise(resolve => setTimeout(resolve, ms));
    };

    let waitTillMined = async (hash) => {
      let transactionReceipt = null;
      const expectedBlockTime = 100;
      while (transactionReceipt == null) {
        transactionReceipt = await web3.eth.getTransactionReceipt(hash);
        if (transactionReceipt == null) {
          await sleep(expectedBlockTime);
        }
      }
    };

  it("Should return the creator as owner", async () => {
    let instance = await Donation.new({from: accounts[0]});
    let owner = await instance.owner();
    assert.equal(owner, accounts[0], "owner is not contract creator!");
  });
  
  it("Should have donation count be 0", async () => {
    let instance = await Donation.deployed();
    let count = await instance.donationCount();
    assert.equal(count, 0, "donationCount is not 0!");
  });

  it("Should send an event on donateETH", async() => {
    let instance = await Donation.deployed();
    const event = instance.Received();
    let pass = false;
    event.once("data", (data) => {
      pass = true;
    });
    let amountToSend = 0.05;
    await instance.donateETH({from: accounts[0], 
      value: web3.utils.toHex( web3.utils.toWei(`${amountToSend}`, "ether") )});
    assert.equal(pass, true, "Event wasn't received!");
  });

  it("Should have donationCount==1 after 1 donation", async() => {
    let instance = await Donation.deployed(); // tap on the previous call
    let donationCount = await instance.donationCount();
    assert.equal(donationCount, 1, "donationCount is not 1!");
  });

  it("Should have donationCount==2 after 2 donations", async() => {
    let instance = await Donation.deployed();
    let donationCount = await instance.donationCount();

    let amountToSend = 0.09;
    let ETHdata = {
      from: accounts[0], 
      value: web3.utils.toHex( web3.utils.toWei(`${amountToSend}`, "ether") )
    };
    await instance.donateETH(ETHdata);
    let donationCount2 = await instance.donationCount();
    assert.equal(donationCount2, 2, "donationCount is not 2!");
  });

  it("Should fire an event on a donation", async() => {
    let instance = await Donation.deployed();
    const event = instance.Received();
    let pass = false;
    let amount = 0.0;
    event.on("data", (data) => {
      let sender = data.args.sender;
      amount = web3.utils.fromWei(`${data.args.amount}`, "ether");
      let count  = data.args.count;
      pass = true;
    });
    
    let amountToSend = 0.10;
    let ETHdata = {
      from: accounts[0], 
      value: web3.utils.toHex( web3.utils.toWei(`${amountToSend}`, "ether") )
    };
    await instance.donateETH(ETHdata);
    console.log(`Received donation of ${amount} ETH from sender`);
    assert.equal(amount, amountToSend, `Amount received is: ${amount}`);
    // console.log(`Amount received is ${amount} ETH.`);   
  });

  it("Should fire an event on emptyBalance", async() => {
    let instance = await Donation.deployed();
    const event = instance.Withdrawn();
    let withdrawn = false;
    var amount = 0.0;
    let receiver;
    event.on("data", (data) => {
      receiver = data.args.receiver;
      amount = web3.utils.fromWei(`${data.args.amount}`, "ether");
      withdrawn = true;
    });
    
    await instance.emptyBalance({from: accounts[0]});
    
    console.log(`Amount withdrawn is: ${amount} and receiver: ${receiver}`);
    assert.equal(withdrawn, true, "Withdrawn event not fired!"); 
  });

  it("Should only allow creator to withdraw", async () => {
    let instance = await Donation.new({from: accounts[0]});
    let succeed = false;
    try {
      await instance.emptyBalance({from: accounts[0]});
      succeed = true;
    } catch (error) {
      console.log("This shouldn't appear!");
    }
    assert.equal(succeed, true, "emptyBalance should succeed!");
  });

  it("Shouldn't allow non-creator to withdraw", async () => {
    let instance = await Donation.new({from: accounts[0]});
    let failed = false;
    try {
      await instance.emptyBalance({from: accounts[1]});
      console.log("emptyBalance should have failed and shouldn't reach here.");
    } catch (error) {
      failed = true;
    }
    assert.equal(failed, true, "emptyBalance should fail!");
  });

  it("Should be able to retrieve the balance for 2 different accounts", async () => {
    let checkSentAndDonorBalance = async (instance, account, amount) => {
      await instance.donateETH({from: account, 
        value: web3.utils.toHex( web3.utils.toWei(`${amount}`, "ether") )});
      // Reading a variable should be pretty fast
      let balanceWei = await instance.donations.call(account);
      let balance = web3.utils.fromWei(`${balanceWei}`, "ether");
      assert.equal(amount, balance, "Amount sent and balance is not the same!");
    };
  
    let instance = await Donation.new({from: accounts[0]});

    await checkSentAndDonorBalance(instance, accounts[0], 0.05);
    await checkSentAndDonorBalance(instance, accounts[1], 0.06);
  });

  it("Should match donor balance with what's donated", async() => {
    let instance = await Donation.new({from: accounts[0]});
    let amount1 = 0.05; let amount2 = 0.09;
    await donateETH(instance, accounts[1], amount1);
    await donateETH(instance, accounts[1], amount2);
    let currentBalance = await getBalance(instance, accounts[1]);

    assert.equal(currentBalance, amount1 + amount2, 
      "Donated amount not equal to current donor balance!");
  });

  it("Should allow creator to enable refund", async() => {
    let instance = await Donation.new({from: accounts[0]});
    let errortracking = 0;
    try {
      await instance.setRefundOk(true, {from: accounts[0]});
      errortracking = 1;
    } catch(error) {
      errortracking = 2;
    }
    assert.equal(errortracking, 1, "Creator can't change refundOk flag!");
  });

  it("Should prevent non-creator from changing refundOk flag", async() => {
    let instance = await Donation.new({from: accounts[0]});
    let errortracking = 0;
    try {
      let refundOk = await getRefundOk(instance);
      console.log(`Current value of refundOk: ${refundOk}`);
      await instance.setRefundOk(true, {from: accounts[1]});
      errortracking = 1;
    } catch (error) {
      console.log("This exception is expected to be triggered: " + error);
      errortracking = 2;
    }
    assert.equal(errortracking, 2, `Non-creator: ${accounts[1]} was able to change refundOk flag!`);
  });

  it("Shouldn't allow a refund when it's not allowed", async() => {
    let instance = await Donation.new({from: accounts[0]});
    let amount1 = 0.05;
    let refundAllowed = await getRefundOk(instance);
    await donateETH(instance, accounts[1], amount1);
    try {
      await refundETH(instance, accounts[1], amount1);
    } catch (error) {
      refundAllowed = false;
    }
    assert.equal(refundAllowed, false, "Refund shouldn't be allowed!");
  });

  it("Should allow a refund when amount (after deducting admin fee) is enough.", async() => {
    let instance = await Donation.new({from: accounts[0]});
    let amount = 0.05;
    await donateETH(instance, accounts[1], amount);
    await setAdminFee(instance, accounts[0], 0.01);
    let adminFee = await getAdminFee(instance);
    let refundTracking = 0;
    try {
      await instance.setRefundOk(true, {from: accounts[0]});
      await refundETH(instance, accounts[1], amount - adminFee);
      refundTracking = 1; 
    } catch (error) {
      refundTracking = 2;
      console.log("This error is unexpected: " + error);
    }
    assert.equal(refundTracking, 1, "Refund should be allowed!");
  });

  it("Shouldn't allow a refund when amount (after deducting admin fee) isn't enough.", async() => {
    let instance = await Donation.new({from: accounts[0]});
    let amount1 = 0.05;
    await donateETH(instance, accounts[1], amount1);
    setAdminFee(instance, accounts[0], amount1+0.01); // make the admin fee higher than the amount itself
    let adminFee = await getAdminFee(instance);
    let refundTracking = 0;
    try {
      await instance.setRefundOk(true, {from: accounts[0]});
      await refundETH(instance, accounts[1], amount);
      refundTracking = 1; 
    } catch (error) {
      refundTracking = 2;
    }
    assert.equal(refundTracking, 2, "Refund shouldn't be allowed!");
  });

  it("Donor balance should be 0 after a full refund", async() => {
    let ownerAccount = accounts[2];
    let userAccount = accounts[1];

    let instance = await Donation.new({from: ownerAccount});
    let amount1 = 0.03; let amount2 = 0.01; var currentBalance;
    try {  

      let tx1 = await donateETH(instance, userAccount, amount1);
      let tx2 = await donateETH(instance, userAccount, amount2);
      
      await waitTillMined(tx1.receipt.transactionHash);
      await waitTillMined(tx2.receipt.transactionHash);

      let tx3 = await instance.setRefundOk(true, {from: ownerAccount});
      await waitTillMined(tx3.receipt.transactionHash);

      let tx4 = await setAdminFee(instance, ownerAccount, 0);
      await waitTillMined(tx4.receipt.transactionHash);

      let amountToRefund = await getBalance(instance, userAccount);
      console.log("Amount to refund: " + amountToRefund);
      let tx5 = await refundETH(instance, userAccount, amountToRefund);
      await waitTillMined(tx5.receipt.transactionHash);

      currentBalance = await getBalance(instance, userAccount);
    } catch (error) {
      console.log(error);
    }
    console.log(`Current balance: ${currentBalance} ETH.`);
    assert.equal(currentBalance, 0, "Donated amount not 0!");
  });

  it("Should fail to refund more than what's available in the account", async () => {
    let instance = await Donation.new({from: accounts[0]});
    let amount1 = 0.07;
    let failed = false;
    let tx1 = await donateETH(instance, accounts[1], amount1);
    try {
      let balance = await getBalance(instance, accounts[0]);
      assert.equal(balance, amount1, "Balance is not donated amount!");
      await refundETH(instance, accounts[1], amount1 + 0.01);
    } catch (error) {
      failed = true;
    }

    assert.equal(failed, true, "Failure in refund!");
  });

});