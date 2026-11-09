// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {WorldManifest} from "../src/WorldManifest.sol";

contract WorldManifestTest is Test {
    WorldManifest manifest;
    address admin = address(0xA11CE);
    address leader = address(0xB0B);
    address other = address(0xCA1);

    function setUp() public {
        manifest = new WorldManifest(admin);
    }

    function test_genesis_is_once_and_names_the_leader() public {
        vm.prank(admin);
        manifest.publishGenesis(bytes32("gen"), bytes32("head"), bytes32("root"), bytes32("rules"), leader, "file:///journal", bytes32("hash"), 893);
        assertTrue(manifest.genesisSet());
        assertEq(manifest.leader(), leader);
        assertEq(manifest.epoch(), 1);
        assertEq(manifest.roleOf(leader), manifest.ROLE_REPLICA());
        assertEq(manifest.roleOf(other), manifest.ROLE_NONE());

        vm.prank(admin);
        vm.expectRevert(WorldManifest.GenesisAlreadySet.selector);
        manifest.publishGenesis(bytes32("gen"), bytes32("head"), bytes32("root"), bytes32("rules"), leader, "", bytes32(0), 0);
    }

    function test_only_the_admin_rotates_and_the_epoch_advances() public {
        vm.prank(admin);
        manifest.publishGenesis(bytes32("gen"), bytes32("head"), bytes32("root"), bytes32("rules"), leader, "", bytes32(0), 1);

        vm.prank(other);
        vm.expectRevert(WorldManifest.NotAdmin.selector);
        manifest.rotateLeader(other);

        vm.prank(admin);
        manifest.rotateLeader(other);
        assertEq(manifest.leader(), other);
        assertEq(manifest.epoch(), 2);
        assertEq(manifest.roleOf(leader), manifest.ROLE_NONE());
        assertEq(manifest.roleOf(other), manifest.ROLE_REPLICA());
    }

    function test_a_leader_is_stale_after_two_intervals() public {
        vm.prank(admin);
        manifest.publishGenesis(bytes32("gen"), bytes32("head"), bytes32("root"), bytes32("rules"), leader, "", bytes32(0), 1);
        uint64 start = uint64(block.timestamp);
        assertFalse(manifest.leaderStale(start + manifest.CHECKPOINT_INTERVAL()));
        assertTrue(manifest.leaderStale(start + (manifest.CHECKPOINT_INTERVAL() * 2) + 1));
    }
}
