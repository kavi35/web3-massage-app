import React, { useMemo, useState } from "react";

const normalize = (value) => String(value || "").toLowerCase();

const sameAddress = (a, b) => normalize(a) === normalize(b);

const shortAddress = (address) =>
  address && address.length > 10
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : address;

export default function MessageCenter({ messages = [], currentUser = "" }) {
  const [selectedPeer, setSelectedPeer] = useState(null);
  const [search, setSearch] = useState("");
  const [readState, setReadState] = useState({});

  const normalizedUser = normalize(currentUser);

  const normalizedMessages = useMemo(() => {
    return messages
      .map((m) => ({
        sender: m.sender,
        receiver: m.receiver,
        content: m.content,
        timestamp: Number(m.timestamp),
      }))
      .filter(
        (m) =>
          sameAddress(m.sender, normalizedUser) ||
          sameAddress(m.receiver, normalizedUser),
      )
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [messages, normalizedUser]);

  const inbox = useMemo(
    () =>
      normalizedMessages
        .filter((m) => sameAddress(m.receiver, normalizedUser))
        .sort((a, b) => b.timestamp - a.timestamp),
    [normalizedMessages, normalizedUser],
  );

  const sent = useMemo(
    () =>
      normalizedMessages
        .filter((m) => sameAddress(m.sender, normalizedUser))
        .sort((a, b) => b.timestamp - a.timestamp),
    [normalizedMessages, normalizedUser],
  );

  const conversations = useMemo(() => {
    const map = new Map();

    normalizedMessages.forEach((m) => {
      const peer = sameAddress(m.sender, normalizedUser)
        ? m.receiver
        : m.sender;
      const key = normalize(peer);
      const existing = map.get(key);

      if (!existing || m.timestamp > existing.latest.timestamp) {
        map.set(key, { peer, latest: m });
      }
    });

    return Array.from(map.values())
      .filter((c) => normalize(c.peer).includes(normalize(search)))
      .sort((a, b) => b.latest.timestamp - a.latest.timestamp);
  }, [normalizedMessages, normalizedUser, search]);

  const thread = useMemo(() => {
    if (!selectedPeer) return [];

    return normalizedMessages.filter((m) => {
      const fromCurrentToPeer =
        sameAddress(m.sender, normalizedUser) &&
        sameAddress(m.receiver, selectedPeer);
      const fromPeerToCurrent =
        sameAddress(m.sender, selectedPeer) &&
        sameAddress(m.receiver, normalizedUser);
      return fromCurrentToPeer || fromPeerToCurrent;
    });
  }, [normalizedMessages, normalizedUser, selectedPeer]);

  const unreadCount = (peer) => {
    const peerKey = normalize(peer);
    const readUntil = Number(readState[peerKey] || 0);

    return normalizedMessages.filter((m) => {
      const incomingFromPeer =
        sameAddress(m.sender, peer) && sameAddress(m.receiver, normalizedUser);
      return incomingFromPeer && m.timestamp > readUntil;
    }).length;
  };

  const openConversation = (peer) => {
    setSelectedPeer(peer);

    const latest = normalizedMessages
      .filter(
        (m) => sameAddress(m.sender, peer) || sameAddress(m.receiver, peer),
      )
      .sort((a, b) => b.timestamp - a.timestamp)[0];

    if (latest) {
      setReadState((prev) => ({
        ...prev,
        [normalize(peer)]: latest.timestamp,
      }));
    }
  };

  return (
    <div className="message-center">
      <div className="columns">
        <aside className="conversation-sidebar">
          <input
            type="text"
            placeholder="Search wallet address"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {conversations.map((c) => {
            const active = sameAddress(selectedPeer, c.peer);
            const unread = unreadCount(c.peer);

            return (
              <button
                key={normalize(c.peer)}
                type="button"
                className={`conversation-item ${active ? "active" : ""}`}
                onClick={() => openConversation(c.peer)}
              >
                <div>
                  <div>{shortAddress(c.peer)}</div>
                  <div>{c.latest.content}</div>
                </div>
                <div>
                  <small>
                    {new Date(c.latest.timestamp * 1000).toLocaleString()}
                  </small>
                  {unread > 0 && <span>{unread}</span>}
                </div>
              </button>
            );
          })}
        </aside>

        <section className="chat-thread">
          {selectedPeer ? (
            <>
              <h3>Chat with {shortAddress(selectedPeer)}</h3>
              {thread.map((m, idx) => {
                const outgoing = sameAddress(m.sender, normalizedUser);
                return (
                  <div
                    key={`${m.timestamp}-${idx}`}
                    className={outgoing ? "out" : "in"}
                  >
                    <p>{m.content}</p>
                    <small>
                      {new Date(m.timestamp * 1000).toLocaleString()}
                    </small>
                  </div>
                );
              })}
            </>
          ) : (
            <p>Select a conversation</p>
          )}
        </section>
      </div>

      <section>
        <h4>Inbox</h4>
        {inbox.map((m, idx) => (
          <div key={`in-${m.timestamp}-${idx}`}>
            <strong>From:</strong> {shortAddress(m.sender)} - {m.content}
          </div>
        ))}
      </section>

      <section>
        <h4>Sent</h4>
        {sent.map((m, idx) => (
          <div key={`out-${m.timestamp}-${idx}`}>
            <strong>To:</strong> {shortAddress(m.receiver)} - {m.content}
          </div>
        ))}
      </section>
    </div>
  );
}
