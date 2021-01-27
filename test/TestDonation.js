const Donation = artifacts.require("Donation");

contract("Donation", async (accounts) => {

  it("returns the creator as owner", async () => {
    let instance = await Donation.new({from: accounts[0]});
    let owner = await instance.owner();
    assert.equal(owner, accounts[0], "owner is not contract creator!");
  });
  
  it("should have donation count be 0", async () => {
    let instance = await Donation.deployed();
    let count = await instance.donationCount();
    assert.equal(count, 0, "donationCount is not 0!");
  });

  it("should send an event on donateETH", async() => {
    let instance = await Donation.deployed();
    const event = instance.Received();
    let pass = false;
    event.once("data", (data) => {
      pass = true;
    });
    let amountToSend = 0.05;
    await instance.donateETH({from: accounts[0], value: web3.utils.toHex( web3.utils.toWei(`${amountToSend}`, "ether") )});
    assert.equal(pass, true, "Event wasn't received!");
  });

  it("should have donationCount==1", async() => {
    let instance = await Donation.deployed();
    let donationCount = await instance.donationCount();
    assert.equal(donationCount, 1, "donationCount is not 1!");
  });

  it("should have donationCount==2", async() => {
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

  it("should fire an event on a donation", async() => {
    let instance = await Donation.deployed();
    const event = instance.Received();
    let pass = false;
    var amount = 0.0;
    event.once("data", (data) => {
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
    
    assert.equal(amount, amountToSend, `Amount received is: ${amount}`);
    console.log(`Amount received is ${amount} ETH.`);    
  });

});