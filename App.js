import React, { useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import * as Notifications from 'expo-notifications';

import HomeScreen from './screens/HomeScreen';
import WordsScreen from './screens/WordsScreen';
import QuizScreen from './screens/QuizScreen';
import SentencesScreen from './screens/SentencesScreen';
import SettingsScreen from './screens/SettingsScreen';
import BottomNavbar from './components/BottomNavbar';
import {
  loadNotificationSettings,
  scheduleNotifications,
  requestPermissions,
  setupNotificationChannel,
} from './utils/notifications';

// Must be at module level — registered before any notification can fire
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const Tab = createBottomTabNavigator();

// Navigate to Quiz with the item data that arrived in the notification.
// Works for both word and sentence notifications — both carry a `type` field.
function handleNotificationData(data, navigationRef) {
  if (!data?.type) return;
  navigationRef.current?.navigate('Quiz', { focusItem: data });
}

export default function App() {
  const navigationRef = useRef(null);

  useEffect(() => {
    (async () => {
      await setupNotificationChannel();

      const settings = await loadNotificationSettings();
      if (settings.enabled) {
        const status = await requestPermissions();
        if (status === 'granted') {
          await scheduleNotifications(settings.frequency);
        }
      }
    })();

    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;
        handleNotificationData(data, navigationRef);
      }
    );

    return () => subscription.remove();
  }, []);

  const handleNavigationReady = async () => {
    const response = await Notifications.getLastNotificationResponseAsync();
    if (response) {
      const data = response.notification.request.content.data;
      handleNotificationData(data, navigationRef);
    }
  };

  return (
    <NavigationContainer ref={navigationRef} onReady={handleNavigationReady}>
      <Tab.Navigator
        tabBar={(props) => <BottomNavbar {...props} />}
        screenOptions={{ headerShown: false }}
      >
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Words" component={WordsScreen} />
        <Tab.Screen name="Quiz" component={QuizScreen} />
        <Tab.Screen name="Sentences" component={SentencesScreen} />
        <Tab.Screen name="Settings" component={SettingsScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
