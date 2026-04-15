import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Member } from "../../services/api/members";
import type { Message } from "../../services/api/messages";
import type { Zone } from "../../services/api/zones";

type AppStateContextValue = {
  zones: Zone[];
  messages: Message[];
  members: Member[];
  setZones: (zones: Zone[]) => void;
  setMessages: (messages: Message[]) => void;
  setMembers: (members: Member[]) => void;
};

const AppStateContext = createContext<AppStateContextValue | undefined>(
  undefined,
);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [zones, setZones] = useState<Zone[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<Member[]>([]);

  const value = useMemo(
    () => ({ zones, messages, members, setZones, setMessages, setMembers }),
    [zones, messages, members],
  );

  return (
    <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
  );
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) throw new Error("useAppState must be used within AppStateProvider");
  return context;
}
