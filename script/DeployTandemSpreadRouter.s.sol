// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "../src/TandemSpreadRouter.sol";

contract DeployTandemSpreadRouter is Script {
    address constant PERPL_EXCHANGE = 0x34B6552d57a35a1D042CcAe1951BD1C370112a6F;
    address constant AUSD           = 0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a;

    function run() external returns (TandemSpreadRouter router) {
        uint256 deployerPrivateKey = vm.envOr("DEPLOYER_PRIVATE_KEY", uint256(0));
        address feeRecipient = vm.envOr("FEE_RECIPIENT", msg.sender);
        
        if (deployerPrivateKey != 0) {
            vm.startBroadcast(deployerPrivateKey);
        } else {
            vm.startBroadcast();
        }

        router = new TandemSpreadRouter(PERPL_EXCHANGE, AUSD, feeRecipient);
        console.log("TandemSpreadRouter deployed at:", address(router));
        console.log("Perpl Exchange:", PERPL_EXCHANGE);
        console.log("Perpl Collateral (AUSD):", AUSD);
        console.log("Fee Recipient:", feeRecipient);

        vm.stopBroadcast();
    }
}
