// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {RootAnchor} from "../src/RootAnchor.sol";

contract RootAnchorTest is Test {
    RootAnchor anchor;
    bytes32 root = keccak256("next-root");
    bytes certificate = hex"01020304";

    function setUp() public {
        anchor = new RootAnchor();
    }

    function test_nothing_is_anchored_until_a_post() public view {
        assertFalse(anchor.hasAnchor());
        assertEq(anchor.lastAnchoredHeight(), 0);
        assertFalse(anchor.isAnchored(0, root));
    }

    function test_post_records_height_root_and_certificate() public {
        anchor.post(0, root, certificate);
        assertTrue(anchor.hasAnchor());
        assertEq(anchor.lastAnchoredHeight(), 0);
        assertTrue(anchor.isAnchored(0, root));
        assertFalse(anchor.isAnchored(0, bytes32(uint256(1))));

        (bytes32 stored, bytes memory cert) = anchor.anchoredRoot(0);
        assertEq(stored, root);
        assertEq(cert, certificate);
    }

    function test_empty_certificate_does_not_anchor() public {
        vm.expectRevert(RootAnchor.EmptyCertificate.selector);
        anchor.post(1, root, "");
        assertFalse(anchor.hasAnchor());
    }

    function test_a_later_height_advances_and_an_older_one_does_not() public {
        anchor.post(4, root, certificate);
        assertEq(anchor.lastAnchoredHeight(), 4);

        bytes32 later = keccak256("later");
        anchor.post(9, later, hex"aa");
        assertEq(anchor.lastAnchoredHeight(), 9);
        assertTrue(anchor.isAnchored(4, root));
        assertTrue(anchor.isAnchored(9, later));
        assertFalse(anchor.isAnchored(5, root));

        vm.expectRevert(abi.encodeWithSelector(RootAnchor.HeightNotAfterAnchor.selector, uint64(9), uint64(9)));
        anchor.post(9, later, hex"bb");
        vm.expectRevert(abi.encodeWithSelector(RootAnchor.HeightNotAfterAnchor.selector, uint64(3), uint64(9)));
        anchor.post(3, root, certificate);
    }

    function test_a_zero_root_is_still_an_anchor() public {
        anchor.post(1, bytes32(0), certificate);
        assertTrue(anchor.hasAnchor());
        assertEq(anchor.lastAnchoredHeight(), 1);
        assertTrue(anchor.isAnchored(1, bytes32(0)));
        (bytes32 stored,) = anchor.anchoredRoot(1);
        assertEq(stored, bytes32(0));
    }
}
