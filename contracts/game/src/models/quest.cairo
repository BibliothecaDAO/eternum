use s1_eternum::alias::ID;

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct Quest {
    #[key]
    pub entity_id: ID,
    #[key]
    pub config_id: ID,
    pub completed: bool,
}
