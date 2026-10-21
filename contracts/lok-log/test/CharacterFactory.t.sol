// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Base} from "./Base.sol";
import {CharacterFactory} from "../src/CharacterFactory.sol";
import {CharacterNFT} from "../src/CharacterNFT.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";

contract CharacterFactoryTest is Base {
    function test_create_seedsSheetAndMints() public view {
        assertEq(nft.ownerOf(tokenId), player);
        assertEq(cp.level(tokenId), 1);
        assertEq(address(factory).balance, 0.001 ether);
    }

    function test_createCharacter_disabled() public {
        vm.prank(player);
        vm.expectRevert(CharacterFactory.CreateCharacterDisabled.selector);
        factory.createCharacter{value: 0.001 ether}(1);
    }

    function test_createCharacterFor_exactFeeOnly() public {
        uint256 expected = nft.nextTokenId() + 1;
        vm.startPrank(player);
        vm.expectRevert(CharacterFactory.WrongFee.selector);
        factory.createCharacterFor{value: 0}(1, expected);
        vm.expectRevert(CharacterFactory.WrongFee.selector);
        factory.createCharacterFor{value: 0.002 ether}(1, expected);
        vm.expectRevert(CharacterFactory.WrongFee.selector);
        factory.createCharacterFor{value: 0.0009 ether}(1, expected);
        vm.stopPrank();
    }

    function test_createCharacterFor_rejectsBadJob() public {
        uint256 expected = nft.nextTokenId() + 1;
        vm.prank(player);
        vm.expectRevert(CharacterFactory.BadJob.selector);
        factory.createCharacterFor{value: 0.001 ether}(9, expected);
    }

    function test_createCharacterFor_incrementingIds() public {
        uint256 expected = nft.nextTokenId() + 1;
        vm.prank(player);
        uint256 second = factory.createCharacterFor{value: 0.001 ether}(1, expected);
        assertEq(second, tokenId + 1);
    }

    function test_createCharacterFor_bindsExpectedId() public {
        uint256 expected = nft.nextTokenId() + 1;
        vm.prank(other);
        vm.deal(other, 1 ether);
        uint256 got = factory.createCharacterFor{value: 0.001 ether}(1, expected);
        assertEq(got, expected);
        assertEq(nft.ownerOf(expected), other);
    }

    function test_createCharacterFor_rejectsWrongId() public {
        uint256 next = nft.nextTokenId() + 1;
        vm.prank(other);
        vm.deal(other, 1 ether);
        vm.expectRevert(CharacterFactory.WrongTokenId.selector);
        factory.createCharacterFor{value: 0.001 ether}(1, next + 1);
        // A skipped payer cannot claim the next id out of order either.
        vm.expectRevert(CharacterFactory.WrongTokenId.selector);
        factory.createCharacterFor{value: 0.001 ether}(1, 0);
    }

    function test_createCharacterFor_paused() public {
        vm.prank(guardian);
        factory.pause();
        uint256 expected = nft.nextTokenId() + 1;
        vm.prank(player);
        vm.expectRevert(PausableUpgradeable.EnforcedPause.selector);
        factory.createCharacterFor{value: 0.001 ether}(1, expected);

        vm.prank(admin);
        factory.unpause();
        vm.prank(player);
        uint256 id = factory.createCharacterFor{value: 0.001 ether}(1, expected);
        assertEq(id, expected);
    }

    function test_onlyFactoryCanMint() public {
        vm.prank(player);
        vm.expectRevert();
        nft.mint(player);
    }

    function test_mint_requiresStateSet() public {
        CharacterNFT bare = CharacterNFT(
            address(
                new ERC1967Proxy(
                    address(new CharacterNFT()), abi.encodeCall(CharacterNFT.initialize, (admin, "C", "C", ""))
                )
            )
        );
        vm.startPrank(admin);
        bare.grantRole(bare.MINTER_ROLE(), admin);
        vm.expectRevert(CharacterNFT.StateNotSet.selector);
        bare.mint(admin);
        vm.stopPrank();
    }

    function test_feeAdmin() public {
        vm.prank(admin);
        factory.setMintFee(0.01 ether);
        uint256 expected = nft.nextTokenId() + 1;
        vm.prank(player);
        vm.expectRevert(CharacterFactory.WrongFee.selector);
        factory.createCharacterFor{value: 0.001 ether}(1, expected);
        vm.prank(player);
        factory.createCharacterFor{value: 0.01 ether}(1, expected);

        vm.prank(other);
        vm.expectRevert();
        factory.setMintFee(1);

        vm.prank(admin);
        vm.expectRevert(CharacterFactory.ZeroFee.selector);
        factory.setMintFee(0);
        assertEq(factory.mintFee(), 0.01 ether);
    }

    function test_withdraw() public {
        address payable to = payable(makeAddr("treasury"));
        vm.prank(other);
        vm.expectRevert();
        factory.withdraw(to);

        vm.prank(admin);
        factory.withdraw(to);
        assertEq(to.balance, 0.001 ether);
        assertEq(address(factory).balance, 0);
    }

    function test_tokenURI() public view {
        assertEq(nft.tokenURI(tokenId), string.concat("ipfs://x/", vm.toString(tokenId)));
    }

    function test_initialize_rejectsZeroAddress() public {
        CharacterFactory impl = new CharacterFactory();
        vm.expectRevert(CharacterFactory.ZeroAddress.selector);
        new ERC1967Proxy(
            address(impl), abi.encodeCall(CharacterFactory.initialize, (address(0), address(nft), address(cp), 0.001 ether))
        );
        vm.expectRevert(CharacterFactory.ZeroAddress.selector);
        new ERC1967Proxy(
            address(impl), abi.encodeCall(CharacterFactory.initialize, (admin, address(0), address(cp), 0.001 ether))
        );
        vm.expectRevert(CharacterFactory.ZeroAddress.selector);
        new ERC1967Proxy(
            address(impl), abi.encodeCall(CharacterFactory.initialize, (admin, address(nft), address(0), 0.001 ether))
        );

        CharacterNFT nftImpl = new CharacterNFT();
        vm.expectRevert(CharacterNFT.ZeroAddress.selector);
        new ERC1967Proxy(address(nftImpl), abi.encodeCall(CharacterNFT.initialize, (address(0), "C", "C", "")));
    }
}
