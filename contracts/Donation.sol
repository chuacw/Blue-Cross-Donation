// SPDX-License-Identifier: UNLICENSED
// author: chuacw, 24 Jan - 26 Jan 2021, Singapore, Singapore

pragma solidity ^0.7.4;

contract Donation {

    address public owner;
    uint256 public donationCount;

    // Declare events
    event Received(address indexed sender, uint256 amount, uint256 count);
    event Withdrawn(address indexed receiver, uint256 amount);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require (msg.sender == owner, "caller is not owner of contract!");
        _;
    }

    function update() internal {
      donationCount++;
      emit Received(msg.sender, msg.value, donationCount);      
    }

    function donateETH() public payable {
      update();
    }

    // fallback function to receive Ether
    fallback() external payable {
      update();
    }

    receive() external payable {
      update();
    }

    function getBalance() external view returns (uint256 result) {
      result = address(this).balance;
    }

    function emptyBalance() public onlyOwner() {
      uint256 value = address(this).balance;
      msg.sender.transfer(value);
      emit Withdrawn(msg.sender, value);
    } 

}
