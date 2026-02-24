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
import {ArmiesScreen} from '../../screens/armies/armies-screen';
import {TradeScreen} from '../../screens/trade/trade-screen';
import {MoreScreen} from '../../screens/more/more-screen';

const Tab = createBottomTabNavigator();
const RootStack = createNativeStackNavigator();

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
        component={CommandScreen}
        options={{
          tabBarIcon: ({color, size}) => <Sword color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Realms"
        component={RealmsScreen}
        options={{
          tabBarIcon: ({color, size}) => <Castle color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Armies"
        component={ArmiesScreen}
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
        component={MoreScreen}
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
        <RootStack.Screen name="Main" component={MainTabs} />
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
