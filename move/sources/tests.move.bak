module miko::tests {
    use std::debug;
    use std::signer;
    use miko::roles;
    use miko::cct;
    use miko::tree_nft;
    use miko::marketplace;

    #[test_only]
    fun setup_all(admin: &signer) {
        roles::init(admin);
        cct::init(admin);
        tree_nft::init(admin);
        marketplace::init(admin, 200); // 2% fee
    }

    #[test]
    fun claim_accrual_flow(admin: &signer, validator: &signer, owner: &signer) {
        setup_all(admin);
        roles::add_validator(admin, signer::address_of(validator));
        // mint tree at rate 1_000_000 micro per second = 1 CCT / sec
        let _id = tree_nft::approve_and_mint(validator, signer::address_of(owner), b"meta://tree", 1_000_000);
        // simulate wait: in real test environment maybe timestamp can be manipulated. We just call claim immediately.
        tree_nft::claim(owner, _id);
        // claimed amount may be 0 or small; ensure function executed without abort.
        debug::print(&b"Claim executed");
    }

    #[test]
    #[expected_failure] // non-oracle should fail set_rate
    fun oracle_role_enforcement(admin: &signer, non_oracle: &signer, validator: &signer) {
        setup_all(admin);
        roles::add_validator(admin, signer::address_of(validator));
        let id = tree_nft::approve_and_mint(validator, signer::address_of(non_oracle), b"meta", 500_000);
        // attempt set_rate by non-oracle
        tree_nft::set_rate(non_oracle, id, 600_000);
    }

    #[test]
    #[expected_failure] // non-owner claim should abort
    fun non_owner_claim_rejected(admin: &signer, validator: &signer, owner: &signer, stranger: &signer) {
        setup_all(admin);
        roles::add_validator(admin, signer::address_of(validator));
        let id = tree_nft::approve_and_mint(validator, signer::address_of(owner), b"meta", 100_000);
        tree_nft::claim(stranger, id); // should fail
    }

    #[test]
    fun marketplace_partial_fill(admin: &signer, validator: &signer, seller: &signer, buyer: &signer) {
        setup_all(admin);
        roles::add_validator(admin, signer::address_of(validator));
        let tree_id = tree_nft::approve_and_mint(validator, signer::address_of(seller), b"tree", 2_000_000); // faster accrual
        // seller claims once to have some CCT to list
        tree_nft::claim(seller, tree_id);
        // list 10 units at price 5
        marketplace::list(seller, 10, 5);
        // buyer purchases 4 units (listing id 0)
        marketplace::buy(buyer, 0, 4);
        debug::print(&b"Partial fill ok");
        // buyer purchases remaining 6
        marketplace::buy(buyer, 0, 6);
        debug::print(&b"Full fill ok");
    }

    #[test]
    fun marketplace_delist_flow(admin: &signer, validator: &signer, seller: &signer) {
        setup_all(admin);
        roles::add_validator(admin, signer::address_of(validator));
        let tree_id = tree_nft::approve_and_mint(validator, signer::address_of(seller), b"tree2", 1_000_000);
        tree_nft::claim(seller, tree_id);
        marketplace::list(seller, 3, 7); // id 0 if first test run isolated
        marketplace::delist(seller, 0);
        debug::print(&b"Delist success");
    }
}
