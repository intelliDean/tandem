// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "forge-std/Test.sol";
import "../src/interfaces/IERC20.sol";

contract FundTrader is Script, Test {
    address constant USDC = 0x754704Bc059F8C67012fEd69BC8A327a5aafb603;
    address constant AUSD = 0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a;

    function fund(address trader, address) external {
        // Find USDC slot
        vm.record();
        IERC20(USDC).balanceOf(trader);
        (bytes32[] memory readsUSDC,) = vm.accesses(USDC);
        bytes32 slotUSDC = readsUSDC[readsUSDC.length - 1];
        console.log("USDC Slot for trader:");
        console.logBytes32(slotUSDC);

        // Find AUSD slot
        vm.record();
        IERC20(AUSD).balanceOf(trader);
        (bytes32[] memory readsAUSD,) = vm.accesses(AUSD);
        bytes32 slotAUSD = readsAUSD[readsAUSD.length - 1];
        console.log("AUSD Slot for trader:");
        console.logBytes32(slotAUSD);
    }
}
