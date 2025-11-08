use crate::utils::tasks::interface::TaskTrait;

pub impl Conqueror of TaskTrait {
    #[inline]
    fn identifier() -> felt252 {
        'CONQUEROR'
    }

    #[inline]
    fn description(count: u32) -> ByteArray {
        match count {
            0 => "",
            1 => "Conquer 1 realm",
            _ => format!("Conquer {} realms", count),
        }
    }
}
