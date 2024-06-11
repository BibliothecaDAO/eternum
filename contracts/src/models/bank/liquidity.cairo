// External imports

use cubit::f128::types::fixed::{Fixed, FixedTrait};

// Dojo imports

use dojo::database::introspect::{Struct, Ty, Introspect, Member};
// Starknet imports

use starknet::ContractAddress;

impl IntrospectFixed of Introspect<Fixed> {
    #[inline(always)]
    fn size() -> Option<usize> {
        Option::Some(2)
    }

    #[inline(always)]
    fn layout() -> dojo::database::introspect::Layout {
        dojo::database::introspect::Layout::Fixed(array![128, 1].span())
    }

    #[inline(always)]
    fn ty() -> Ty {
        Ty::Struct(
            Struct {
                name: 'Fixed',
                attrs: array![].span(),
                children: array![
                    Member { name: 'mag', ty: Ty::Primitive('u128'), attrs: array![].span() },
                    Member { name: 'sign', ty: Ty::Primitive('bool'), attrs: array![].span() }
                ]
                    .span()
            }
        )
    }
}

#[derive(Copy, Drop, Serde)]
#[dojo::model]
struct Liquidity {
    #[key]
    bank_entity_id: u128,
    #[key]
    player: ContractAddress,
    #[key]
    resource_type: u8,
    shares: Fixed,
}
