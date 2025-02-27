use cubit::f128::types::fixed::{Fixed};
use dojo::meta::introspect::{Introspect, Member, Struct, Ty};
use starknet::ContractAddress;

pub impl IntrospectFixed of Introspect<Fixed> {
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
                    Member { name: 'sign', ty: Ty::Primitive('bool'), attrs: array![].span() },
                ]
                    .span(),
            },
        )
    }
}

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct Liquidity {
    #[key]
    pub player: ContractAddress,
    #[key]
    pub resource_type: u8,
    pub shares: Fixed,
}
