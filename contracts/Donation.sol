// SPDX-License-Identifier: UNLICENSED
// author: chuacw, 24 Jan - 1 Feb 2021, Singapore, Singapore

pragma solidity ^0.7.4;

contract Donation {

    address public owner;
    uint256 public donationCount;

    uint256 public adminFee;     // admin fee for refund
    uint256 public refundCount;
    uint256 public emptyCount;

    bool public refundOk;

    mapping (address => uint256) public donations;

    // Declare events
    event Received(address indexed sender, uint256 amount, uint256 count);
    event Refunded(address indexed receiver, uint256 amount, uint256 count);
    event Withdrawn(address indexed receiver, uint256 amount, uint256 count);
    
    event AdminFeeChanged(uint256 amount);
    event RefundStatusChanged(bool refundOk);

    constructor() {
      owner = msg.sender;
      refundOk = false; // Do not refund initially
    }

    modifier onlyOwner() {
      require (msg.sender == owner, "caller is not owner of contract!");
      _;
    }

    modifier refundAllowed() {
      require (refundOk == true, "Refund is currently not allowed");
      _;
    }

    function update() internal {
      donationCount++;
      emit Received(msg.sender, msg.value, donationCount);      
    }

    function donateETH() public payable {
      address sender = msg.sender;
      uint256 donorBalance = donations[sender];
      donations[sender] = safeAdd(donorBalance, msg.value);
      update();
    }

    function getBalance() external view returns (uint256 result) {
      result = address(this).balance;
    }

    function emptyBalance() external onlyOwner() {
      uint256 value = address(this).balance;
      emit Withdrawn(msg.sender, value, ++emptyCount);
      msg.sender.transfer(value);
    }

    function setRefundOk(bool newRefundOk) external onlyOwner() {
      refundOk = newRefundOk;
      emit RefundStatusChanged(newRefundOk);
    }

    function setAdminFee(uint256 newAdminFee) external onlyOwner() {
      adminFee = newAdminFee;
      emit AdminFeeChanged(newAdminFee);
    }

    function refund(uint256 amount) external refundAllowed() {
      uint256 donorBalance = donations[msg.sender];
      uint256 totalAmount = safeAdd(amount, adminFee);
      require (totalAmount <= donorBalance, "refund amount + adminFee amount exceeds donor balance!");

      donations[msg.sender] = safeSub(donorBalance, totalAmount); // deduct amount + adminFee
      emit Refunded(msg.sender, amount, ++refundCount); // show refund of amount
      msg.sender.transfer(amount);
    }

    // fallback function to receive Ether
    fallback() external payable {
      update();
    }

    receive() external payable {
      update();
    }

    function safeAdd(uint a, uint b) pure internal returns (uint) {
      uint256 c = a + b;
      require(c >= a, "a > c in safeAdd");
      return c;
    }

    function safeSub(uint a, uint b) pure internal returns (uint) {
      require(b <= a, "b > a in safeSub!");
      return a - b;
    }

}
