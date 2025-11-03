module miko::oracle {
	use std::signer;
	use aptos_std::event;
	use aptos_framework::account;
	use miko::roles;
	use miko::tree_nft;

	const E_NOT_ORACLE: u64 = 1;

	struct Events has key { rate_updates: event::EventHandle<RateUpdate> }
	struct RateUpdate has drop, store { tree_id: u64, new_rate_ppm: u64 }

	public entry fun init(admin: &signer) {
		roles::assert_admin(signer::address_of(admin));
		move_to(admin, Events { rate_updates: account::new_event_handle<RateUpdate>(admin) });
	}

	public entry fun set_rate(oracle_signer: &signer, tree_id: u64, new_rate_ppm: u64) acquires Events {
		assert!(roles::is_oracle(signer::address_of(oracle_signer)), E_NOT_ORACLE);
		tree_nft::set_rate_internal(tree_id, new_rate_ppm);
		let ev = borrow_global_mut<Events>(@admin);
		event::emit_event(&mut ev.rate_updates, RateUpdate { tree_id, new_rate_ppm });
	}
}