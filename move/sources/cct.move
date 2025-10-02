module miko::cct {
    use std::signer;
    use aptos_framework::coin;
    use aptos_framework::aptos_account;
    use aptos_framework::timestamp;

    /// Carbon Credit Token definition
    struct CCT has store, drop {}

    struct MintCap has key { cap: coin::MintCapability<CCT> }
    struct BurnCap has key { cap: coin::BurnCapability<CCT> }

    const E_NOT_ADMIN: u64 = 1;
    const E_ALREADY_INIT: u64 = 2;

    public entry fun init(admin: &signer) {
        let admin_addr = signer::address_of(admin);
        assert!(admin_addr == @admin, E_NOT_ADMIN);
        assert!(!exists<MintCap>(@admin), E_ALREADY_INIT);
        coin::register<CCT>(admin);
        let (mint_cap, burn_cap) = coin::initialize<CCT>(admin, b"Carbon Credit Token", b"CCT", 6, false);
        move_to(admin, MintCap { cap: mint_cap });
        move_to(admin, BurnCap { cap: burn_cap });
    }

    public fun mint(to: &signer, amount: u64) acquires MintCap {
        let cap = &borrow_global<MintCap>(@admin).cap;
        coin::deposit(signer::address_of(to), coin::mint(amount, cap));
    }

    public fun mint_to_address(to: address, amount: u64) acquires MintCap {
        let cap = &borrow_global<MintCap>(@admin).cap;
        if (!coin::is_account_registered<CCT>(to)) {
            aptos_account::create_account_for_test(to);
            // register but ignore error if concurrent; PoC simplification
            coin::register_named<CCT>(to);
        };
        coin::deposit(to, coin::mint(amount, cap));
    }

    public fun balance(addr: address): u64 {
        if (!coin::is_account_registered<CCT>(addr)) return 0; 
        coin::balance<CCT>(addr)
    }
}