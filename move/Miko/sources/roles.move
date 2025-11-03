module miko::roles {
    use std::signer;
    use std::vector;

    const E_NOT_ADMIN: u64 = 1;
    const E_ALREADY_INIT: u64 = 2;

    struct Roles has key {
        admin: address,
        oracles: vector<address>,
        validators: vector<address>,
    }

    public entry fun init(admin: &signer) {
        let addr = signer::address_of(admin);
        assert!(addr == @admin, E_NOT_ADMIN);
        assert!(!exists<Roles>(@admin), E_ALREADY_INIT);
        move_to(admin, Roles { admin: addr, oracles: vector::empty(), validators: vector::empty() });
    }

    public fun assert_admin(addr: address) acquires Roles {
        let roles = borrow_global<Roles>(@admin);
        assert!(roles.admin == addr, E_NOT_ADMIN);
    }

    public entry fun add_oracle(admin_signer: &signer, addr: address) acquires Roles {
        assert_admin(signer::address_of(admin_signer));
        let roles = borrow_global_mut<Roles>(@admin);
        vector::push_back(&mut roles.oracles, addr);
    }

    public entry fun add_validator(admin_signer: &signer, addr: address) acquires Roles {
        assert_admin(signer::address_of(admin_signer));
        let roles = borrow_global_mut<Roles>(@admin);
        vector::push_back(&mut roles.validators, addr);
    }

    public fun is_oracle(addr: address): bool acquires Roles {
        let roles = borrow_global<Roles>(@admin);
        contains(&roles.oracles, addr)
    }

    public fun is_validator(addr: address): bool acquires Roles {
        let roles = borrow_global<Roles>(@admin);
        contains(&roles.validators, addr)
    }

    fun contains(list: &vector<address>, target: address): bool {
        let i = 0;
        let len = vector::length(list);
        while (i < len) {
            if (*vector::borrow(list, i) == target) return true;
            i = i + 1;
        };
        false
    }
}