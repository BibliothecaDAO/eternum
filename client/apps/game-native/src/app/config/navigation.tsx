import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {
  Sword,
  Castle,
  Shield,
  ArrowLeftRight,
  Menu,
} from 'lucide-react-native';
import {useAuth} from '../../shared/hooks/use-auth';
import {useTheme} from '../providers/theme-provider';
import {LoginScreen} from '../../screens/auth/login-screen';
import {CommandScreen} from '../../screens/command/command-screen';
import {RealmsScreen} from '../../screens/realms/realms-screen';
import {RealmDetailScreen} from '../../screens/realms/realm-detail-screen';
import {ArmiesScreen} from '../../screens/armies/armies-screen';
import {ArmyDetailScreen} from '../../screens/armies/army-detail-screen';
import {TradeScreen} from '../../screens/trade/trade-screen';
import {MoreScreen} from '../../screens/more/more-screen';
import {ChatScreen} from '../../screens/chat/chat-screen';
import {GuildScreen} from '../../screens/guild/guild-screen';
import {GuildDetailScreen} from '../../screens/guild/guild-detail-screen';
import {LeaderboardScreen} from '../../screens/leaderboard/leaderboard-screen';
import {QuestsScreen} from '../../screens/quests/quests-screen';
import {LordpediaScreen} from '../../screens/lordpedia/lordpedia-screen';
import type {
  RootStackParamList,
  CommandStackParamList,
  RealmsStackParamList,
  ArmiesStackParamList,
  MoreStackParamList,
} from './types';

const Tab = createBottomTabNavigator();
const RootStack = createNativeStackNavigator<RootStackParamList>();
const CommandStack = createNativeStackNavigator<CommandStackParamList>();
const RealmsStack = createNativeStackNavigator<RealmsStackParamList>();
const ArmiesStack = createNativeStackNavigator<ArmiesStackParamList>();
const MoreStack = createNativeStackNavigator<MoreStackParamList>();

function CommandStackNavigator() {
  return (
    <CommandStack.Navigator screenOptions={{headerShown: false}}>
      <CommandStack.Screen name="CommandDashboard" component={CommandScreen} />
    </CommandStack.Navigator>
  );
}

function RealmsStackNavigator() {
  return (
    <RealmsStack.Navigator screenOptions={{headerShown: false}}>
      <RealmsStack.Screen name="RealmsList" component={RealmsScreen} />
      <RealmsStack.Screen name="RealmDetail" component={RealmDetailScreen} />
    </RealmsStack.Navigator>
  );
}

function ArmiesStackNavigator() {
  return (
    <ArmiesStack.Navigator screenOptions={{headerShown: false}}>
      <ArmiesStack.Screen name="ArmiesList" component={ArmiesScreen} />
      <ArmiesStack.Screen name="ArmyDetail" component={ArmyDetailScreen} />
    </ArmiesStack.Navigator>
  );
}

function MoreStackNavigator() {
  return (
    <MoreStack.Navigator screenOptions={{headerShown: false}}>
      <MoreStack.Screen name="MoreHome" component={MoreScreen} />
      <MoreStack.Screen name="Chat" component={ChatScreen} />
      <MoreStack.Screen name="Guild" component={GuildScreen} />
      <MoreStack.Screen name="GuildDetail" component={GuildDetailScreen} />
      <MoreStack.Screen name="Leaderboard" component={LeaderboardScreen} />
      <MoreStack.Screen name="Quests" component={QuestsScreen} />
      <MoreStack.Screen name="Lordpedia" component={LordpediaScreen} />
    </MoreStack.Navigator>
  );
}

function MainTabs() {
  const {colors} = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
        },
      }}>
      <Tab.Screen
        name="Command"
        component={CommandStackNavigator}
        options={{
          tabBarIcon: ({color, size}) => <Sword color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Realms"
        component={RealmsStackNavigator}
        options={{
          tabBarIcon: ({color, size}) => <Castle color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Armies"
        component={ArmiesStackNavigator}
        options={{
          tabBarIcon: ({color, size}) => <Shield color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Trade"
        component={TradeScreen}
        options={{
          tabBarIcon: ({color, size}) => (
            <ArrowLeftRight color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="More"
        component={MoreStackNavigator}
        options={{
          tabBarIcon: ({color, size}) => <Menu color={color} size={size} />,
        }}
      />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  const {isAuthenticated} = useAuth();

  return (
    <RootStack.Navigator screenOptions={{headerShown: false}}>
      {isAuthenticated ? (
        <RootStack.Screen name="MainTabs" component={MainTabs} />
      ) : (
        <RootStack.Screen
          name="Login"
          component={LoginScreen}
          options={{animationTypeForReplace: 'pop' as const}}
        />
      )}
    </RootStack.Navigator>
  );
}

export function AppNavigator() {
  return (
    <NavigationContainer>
      <RootNavigator />
    </NavigationContainer>
  );
}
