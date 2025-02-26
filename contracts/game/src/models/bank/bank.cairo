use s1_eternum::alias::ID;

// Used as helper struct throughout the world
#[derive(Introspect, Copy, Drop, Serde)]
#[dojo::model]
pub struct Bank {
    #[key]
    pub entity_id: ID,
    pub exists: bool,
}

