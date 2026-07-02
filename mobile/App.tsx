import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { api } from "./src/api";
import { registerForPush } from "./src/push";

type Business = { id: string; name: string };
type ChatMsg = { role: "user" | "assistant"; content: string };

const COLORS = {
  bg: "#0a0a0f",
  card: "#14141c",
  border: "#26263a",
  text: "#f4f4f8",
  muted: "#9a9ab0",
  accent: "#7c5cff",
};

export default function App() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [business, setBusiness] = useState<Business | null>(null);

  useEffect(() => {
    (async () => {
      setAuthed(await api.hasSession());
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (authed) registerForPush();
  }, [authed]);

  if (!ready) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={COLORS.accent} />
      </View>
    );
  }

  if (!authed) return <Login onDone={() => setAuthed(true)} />;
  if (!business) return <Picker onPick={setBusiness} onLogout={() => { api.logout(); setAuthed(false); }} />;
  return <Chat business={business} onBack={() => setBusiness(null)} />;
}

function Login({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.login(email.trim(), password);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, styles.center]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar style="light" />
      <Text style={styles.brand}>Bizweave</Text>
      <Text style={styles.subtitle}>Your business, operated while you sleep.</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={COLORS.muted}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor={COLORS.muted}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TouchableOpacity style={styles.button} onPress={submit} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign in</Text>}
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

function Picker({ onPick, onLogout }: { onPick: (b: Business) => void; onLogout: () => void }) {
  const [businesses, setBusinesses] = useState<Business[] | null>(null);

  useEffect(() => {
    api.listBusinesses().then((r) => setBusinesses(r.businesses)).catch(() => setBusinesses([]));
  }, []);

  if (!businesses) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={COLORS.accent} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: 64, paddingHorizontal: 20 }]}>
      <StatusBar style="light" />
      <Text style={styles.header}>Your businesses</Text>
      <FlatList
        data={businesses}
        keyExtractor={(b) => b.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.bizRow} onPress={() => onPick(item)}>
            <Text style={styles.bizName}>{item.name}</Text>
            <Text style={styles.muted}>›</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.muted}>No businesses yet. Create one on the web.</Text>}
      />
      <TouchableOpacity onPress={onLogout} style={{ paddingVertical: 16 }}>
        <Text style={styles.muted}>Log out</Text>
      </TouchableOpacity>
    </View>
  );
}

function Chat({ business, onBack }: { business: Business; onBack: () => void }) {
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: "assistant", content: `Hi! I'm your Bizweave operator for ${business.name}. Ask me to build a site, run an ad, set up a receptionist, or anything else.` },
  ]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();

  const send = useCallback(async () => {
    const t = text.trim();
    if (!t || busy) return;
    setText("");
    setMessages((m) => [...m, { role: "user", content: t }]);
    setBusy(true);
    try {
      const res = await api.sendChat(business.id, t, conversationId);
      setConversationId(res.conversationId);
      setMessages((m) => [...m, { role: "assistant", content: res.reply }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: `Something went wrong: ${e instanceof Error ? e.message : e}` }]);
    } finally {
      setBusy(false);
    }
  }, [text, busy, business.id, conversationId]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
      <StatusBar style="light" />
      <View style={styles.topbar}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.accent}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>{business.name}</Text>
        <View style={{ width: 48 }} />
      </View>
      <FlatList
        data={messages}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.role === "user" ? styles.userBubble : styles.aiBubble]}>
            <Text style={item.role === "user" ? styles.userText : styles.aiText}>{item.content}</Text>
          </View>
        )}
      />
      <View style={styles.composer}>
        <TextInput
          style={styles.composerInput}
          placeholder="Message your operator…"
          placeholderTextColor={COLORS.muted}
          value={text}
          onChangeText={setText}
          multiline
        />
        <TouchableOpacity style={styles.sendBtn} onPress={send} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { justifyContent: "center", alignItems: "center", padding: 24 },
  brand: { color: COLORS.text, fontSize: 40, fontWeight: "800", marginBottom: 8 },
  subtitle: { color: COLORS.muted, fontSize: 15, marginBottom: 32, textAlign: "center" },
  header: { color: COLORS.text, fontSize: 26, fontWeight: "700", marginBottom: 16 },
  input: {
    width: "100%",
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: COLORS.text,
    marginBottom: 12,
  },
  button: {
    width: "100%",
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  error: { color: "#ff6b6b", marginBottom: 8 },
  muted: { color: COLORS.muted },
  accent: { color: COLORS.accent, fontWeight: "600" },
  bizRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 18,
    marginBottom: 10,
  },
  bizName: { color: COLORS.text, fontSize: 16, fontWeight: "600" },
  topbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomColor: COLORS.border,
    borderBottomWidth: 1,
  },
  topTitle: { color: COLORS.text, fontSize: 16, fontWeight: "700" },
  bubble: { maxWidth: "85%", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  userBubble: { alignSelf: "flex-end", backgroundColor: COLORS.accent },
  aiBubble: { alignSelf: "flex-start", backgroundColor: COLORS.card, borderColor: COLORS.border, borderWidth: 1 },
  userText: { color: "#fff", fontSize: 15 },
  aiText: { color: COLORS.text, fontSize: 15 },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 12,
    gap: 8,
    borderTopColor: COLORS.border,
    borderTopWidth: 1,
  },
  composerInput: {
    flex: 1,
    maxHeight: 120,
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: COLORS.text,
  },
  sendBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 12,
    alignItems: "center",
  },
});
