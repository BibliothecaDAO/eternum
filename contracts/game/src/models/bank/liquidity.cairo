use cubit::f128::types::fixed::{Fixed, FixedTrait};
use dojo::meta::introspect::{Struct, Ty, Introspect, Member};
use s0_eternum::alias::ID;
use starknet::ContractAddress;

impl IntrospectFixed of Introspect<Fixed> {
    #[inline(always)]
    fn size() -> Option<usize> {
        Option::Some(2)
    }

    #[inline(always)]
    fn layout() -> dojo::meta::Layout {
        dojo::meta::Layout::Fixed(array![128, 1].span())
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

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct Liquidity {
    #[key]
    bank_entity_id: ID,
    #[key]
    player: ContractAddress,
    #[key]
    resource_type: u8,
    shares: Fixed,
}
