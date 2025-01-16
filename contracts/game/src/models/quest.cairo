use s1_eternum::alias::ID;

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct Quest {
    #[key]
    entity_id: ID,
    #[key]
    config_id: ID,
    completed: bool,
}