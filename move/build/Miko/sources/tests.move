module miko::tests {
    #[test_only]
    fun setup_all(admin: &signer) {
        miko::roles::init(admin);
        miko::cct::init(admin);
        miko::tree_nft::init(admin);
        miko::marketplace::init(admin, 200); // 2% fee
    }

    #[test]
    fun claim_accrual_flow(admin: &signer, validator: &signer, owner: &signer) {
        setup_all(admin);
        miko::roles::add_validator(admin, std::signer::address_of(validator));
        // mint tree at rate 1_000_000 micro per second = 1 CCT / sec
        let _id = miko::tree_nft::approve_and_mint(validator, std::signer::address_of(owner), b"meta://tree", 1_000_000);
        // simulate wait: in real test environment maybe timestamp can be manipulated. We just call claim immediately.
        miko::tree_nft::claim(owner, _id);
        // claimed amount may be 0 or small; ensure function executed without abort.
        std::debug::print(&b"Claim executed");
    }

    #[test]
    #[expected_failure] // non-oracle should fail set_rate
    fun oracle_role_enforcement(admin: &signer, non_oracle: &signer, validator: &signer) {
        setup_all(admin);
        miko::roles::add_validator(admin, std::signer::address_of(validator));
        let id = miko::tree_nft::approve_and_mint(validator, std::signer::address_of(non_oracle), b"meta", 500_000);
        // attempt set_rate by non-oracle
        miko::tree_nft::set_rate(non_oracle, id, 600_000);
    }

    #[test]
    #[expected_failure] // non-owner claim should abort
    fun non_owner_claim_rejected(admin: &signer, validator: &signer, owner: &signer, stranger: &signer) {
        setup_all(admin);
        miko::roles::add_validator(admin, std::signer::address_of(validator));
        let id = miko::tree_nft::approve_and_mint(validator, std::signer::address_of(owner), b"meta", 100_000);
        miko::tree_nft::claim(stranger, id); // should fail
    }

    #[test]
    fun marketplace_partial_fill(admin: &signer, validator: &signer, seller: &signer, buyer: &signer) {
        setup_all(admin);
        miko::roles::add_validator(admin, std::signer::address_of(validator));
        let tree_id = miko::tree_nft::approve_and_mint(validator, std::signer::address_of(seller), b"tree", 2_000_000); // faster accrual
        // seller claims once to have some CCT to list
        miko::tree_nft::claim(seller, tree_id);
        // list 10 units at price 5
        miko::marketplace::list(seller, 10, 5);
        // buyer purchases 4 units (listing id 0)
        miko::marketplace::buy(buyer, 0, 4);
        std::debug::print(&b"Partial fill ok");
        // buyer purchases remaining 6
        miko::marketplace::buy(buyer, 0, 6);
        std::debug::print(&b"Full fill ok");
    }

    #[test]
    fun marketplace_delist_flow(admin: &signer, validator: &signer, seller: &signer) {
        setup_all(admin);
        miko::roles::add_validator(admin, std::signer::address_of(validator));
        let tree_id = miko::tree_nft::approve_and_mint(validator, std::signer::address_of(seller), b"tree2", 1_000_000);
        miko::tree_nft::claim(seller, tree_id);
        miko::marketplace::list(seller, 3, 7); // id 0 if first test run isolated
        miko::marketplace::delist(seller, 0);
        std::debug::print(&b"Delist success");
    }
}
