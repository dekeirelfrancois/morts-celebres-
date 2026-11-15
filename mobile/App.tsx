import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";
const POLL_INTERVAL_MS = 30_000;

type DeathEntry = {
  id: string;
  title: string;
  description: string;
  link: string;
  source: string;
  publishedAt: string;
  score: number;
};

function formatAge(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days} j`;
}

export default function App() {
  const [entries, setEntries] = useState<DeathEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const knownIds = useRef<Set<string>>(new Set());

  const fetchEntries = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/deaths?limit=100`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const fresh = data.items.filter((e: DeathEntry) => !knownIds.current.has(e.id));
      for (const e of data.items) knownIds.current.add(e.id);
      setEntries(data.items);
      setError(null);
      setLastUpdate(new Date());
      if (fresh.length > 0 && knownIds.current.size > data.items.length) {
        console.log(`${fresh.length} nouvelle(s) annonce(s)`);
      }
    } catch (e: any) {
      setError(e.message || "Erreur réseau");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
    const id = setInterval(fetchEntries, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchEntries]);

  const renderItem = ({ item }: { item: DeathEntry }) => (
    <Pressable style={styles.card} onPress={() => item.link && Linking.openURL(item.link)}>
      <View style={styles.cardHeader}>
        <Text style={styles.source}>{item.source}</Text>
        <Text style={styles.age}>{formatAge(item.publishedAt)}</Text>
      </View>
      <Text style={styles.title}>{item.title}</Text>
      {item.description ? (
        <Text style={styles.description} numberOfLines={3}>
          {item.description}
        </Text>
      ) : null}
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Deathswatch</Text>
        <Text style={styles.headerSubtitle}>
          {lastUpdate
            ? `Actualisé à ${lastUpdate.toLocaleTimeString("fr-FR")}`
            : "Chargement…"}
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator style={styles.spinner} color="#e05555" size="large" />
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>Impossible de joindre le serveur : {error}</Text>
          <Text style={styles.errorHint}>
            Vérifiez que le backend tourne et que EXPO_PUBLIC_API_URL pointe vers lui.
          </Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>
                Aucune annonce détectée pour le moment.{"\n"}
                Le serveur scrute la presse en continu.
              </Text>
            </View>
          }
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={fetchEntries} tintColor="#e05555" />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f1115",
    paddingTop: 50,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#2a2d35",
  },
  headerTitle: {
    color: "#f2f3f5",
    fontSize: 24,
    fontWeight: "700",
  },
  headerSubtitle: {
    color: "#8a8f98",
    fontSize: 12,
    marginTop: 2,
  },
  list: {
    padding: 12,
  },
  card: {
    backgroundColor: "#171a21",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#2a2d35",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  source: {
    color: "#e05555",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  age: {
    color: "#8a8f98",
    fontSize: 11,
  },
  title: {
    color: "#f2f3f5",
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 21,
  },
  description: {
    color: "#a9aeb8",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
  },
  spinner: {
    marginTop: 40,
  },
  center: {
    alignItems: "center",
    marginTop: 60,
    paddingHorizontal: 24,
  },
  emptyText: {
    color: "#8a8f98",
    textAlign: "center",
    lineHeight: 20,
  },
  errorText: {
    color: "#e05555",
    textAlign: "center",
    marginBottom: 8,
  },
  errorHint: {
    color: "#8a8f98",
    textAlign: "center",
    fontSize: 12,
  },
});
