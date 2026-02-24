export type RootStackParamList = {
  Login: undefined;
  MainTabs: undefined;
};

export type CommandStackParamList = {
  CommandDashboard: undefined;
  RealmDetail: {realmEntityId: number};
};

export type RealmsStackParamList = {
  RealmsList: undefined;
  RealmDetail: {realmEntityId: number};
};
