// we are importing tabs (Buttons) so we can build navigation between pages
import { Tabs } from "expo-router";
// Impoting icons library to use icons
import { Ionicons } from "@expo/vector-icons";
// importing colors that are already we told easted of writing everywhere we are using like this
import { colors } from "../../constants/colors";
// this is an defoult component that is returning tabs
export default function TabLayout() {
  return (
    <Tabs
    // Screen OPtions like General Settings
      screenOptions={{
        tabBarActiveTintColor: colors.tabBar.active,
        tabBarInactiveTintColor: colors.tabBar.inactive,
        tabBarStyle: {
          backgroundColor: colors.tabBar.background,
          borderTopColor: colors.border,
        },
        headerBackButtonDisplayMode: "minimal",
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
