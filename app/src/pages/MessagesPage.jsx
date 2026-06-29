import React, { useMemo, useState } from "react";

const MESSAGE_SECTIONS = [
  {
    id: "weekly",
    title: "Weekly Meeting Messages",
    helper: "Normal Friday meeting workflow.",
    messages: [
      {
        key: "invite",
        title: "Weekly Invite",
        description: "Ask a volunteer if they can serve this Friday.",
      },
      {
        key: "followUp",
        title: "Wednesday Follow-Up",
        description: "Follow up when someone has not replied yet.",
      },
      {
        key: "reminder",
        title: "Friday Reminder",
        description: "Remind confirmed volunteers about the meeting.",
      },
      {
        key: "firstTime",
        title: "First-Time Volunteer",
        description: "Extra instructions for someone serving for the first time.",
      },
      {
        key: "gatewayEmployee",
        title: "Gateway Employee Message",
        description: "Message used for Gateway Employee communication.",
      },
      {
        key: "firstStepLeadRequest",
        title: "1st Step Lead Request",
        description: "Ask someone to lead the 1st Step portion of the meeting.",
      },
    ],
  },
  {
    id: "requirements",
    title: "Gateway Requirements",
    helper: "Application, email, background check, and drug test messages.",
    messages: [
      {
        key: "gatewayApplicationRequest",
        title: "Gateway Application / Email Request",
        description: "Ask a volunteer for their email so Gateway HR can start the process.",
      },
      {
        key: "gatewayEmailReceivedFollowUp",
        title: "Email Received Follow-Up",
        description: "Check whether the volunteer received the Gateway HR email.",
      },
      {
        key: "gatewayBackgroundCheckFollowUp",
        title: "Background Check Follow-Up",
        description: "Follow up if the background check still needs to be completed.",
      },
      {
        key: "gatewayDrugTestFollowUp",
        title: "Drug Test Follow-Up",
        description: "Follow up if the drug test still needs to be completed.",
      },
      {
        key: "gatewayRequirementsComplete",
        title: "Requirements Complete / Thank You",
        description: "Thank the volunteer once all Gateway requirements are complete.",
      },
    ],
  },
  {
    id: "tracker",
    title: "Volunteer Tracker Follow-Ups",
    helper: "Messages connected to the volunteer requirements tracker.",
    messages: [
      {
        key: "gatewayApplicationSentToHR",
        title: "Application Sent to HR Confirmation",
        description: "Let the volunteer know their email was sent to Gateway HR.",
      },
      {
        key: "gatewayMissingStepReminder",
        title: "Missing Step Reminder",
        description: "A general reminder when one part of the process is still incomplete.",
      },
      {
        key: "gatewayProcessCheckIn",
        title: "Process Check-In",
        description: "Check in kindly when you are not sure where they are in the process.",
      },
    ],
  },
  {
    id: "care",
    title: "Check-In / Care Messages",
    helper: "Messages for care, clarity, and volunteer availability.",
    messages: [
      {
        key: "checkIn",
        title: "Check-In / Consider Pausing",
        description: "Check in with a volunteer when they may need to pause serving.",
      },
    ],
  },
];

export default function MessagesPage({ appState, setAppState }) {
  const msgs = appState?.settings?.messages ?? {};

  const [selectedSectionId, setSelectedSectionId] = useState(
    MESSAGE_SECTIONS[0].id
  );

  const selectedSection = useMemo(() => {
    return (
      MESSAGE_SECTIONS.find((section) => section.id === selectedSectionId) ??
      MESSAGE_SECTIONS[0]
    );
  }, [selectedSectionId]);

  const [selectedMessageKey, setSelectedMessageKey] = useState(
    MESSAGE_SECTIONS[0].messages[0].key
  );

  const selectedMessage = useMemo(() => {
    const allMessages = MESSAGE_SECTIONS.flatMap((section) => section.messages);

    return (
      allMessages.find((message) => message.key === selectedMessageKey) ??
      MESSAGE_SECTIONS[0].messages[0]
    );
  }, [selectedMessageKey]);

  /**
   * Updates one saved message in appState.settings.messages.
   * Keeps all other settings/messages intact.
   * Saves automatically as the user types.
   */
  function setMsg(key, value) {
    setAppState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        messages: {
          ...prev.settings.messages,
          [key]: value,
        },
      },
    }));
  }

  function handleSectionSelect(section) {
    setSelectedSectionId(section.id);

    const firstMessage = section.messages[0];
    if (firstMessage) {
      setSelectedMessageKey(firstMessage.key);
    }
  }

  return (
    <div>
      <header style={styles.header}>
        <div>
          <h2 style={styles.title}>Messages</h2>
          <p style={styles.subtitle}>
            Choose a message, edit it once, and reuse it during the service
            workflow.
          </p>
        </div>
      </header>

      <section style={styles.helpCard}>
        <div style={styles.helpTitle}>How this page works</div>
        <div style={styles.helpText}>
          Pick a message group, choose the message you want to edit, then update
          the saved text below. Changes save automatically.
        </div>
      </section>

      <section style={styles.sectionGrid} aria-label="Message groups">
        {MESSAGE_SECTIONS.map((section) => {
          const isSelected = section.id === selectedSectionId;

          return (
            <button
              key={section.id}
              type="button"
              onClick={() => handleSectionSelect(section)}
              style={{
                ...styles.sectionButton,
                ...(isSelected ? styles.sectionButtonActive : {}),
              }}
            >
              <div style={styles.sectionButtonTitle}>{section.title}</div>
              <div style={styles.sectionButtonHelper}>{section.helper}</div>
              <div style={styles.sectionCount}>
                {section.messages.length} message
                {section.messages.length === 1 ? "" : "s"}
              </div>
            </button>
          );
        })}
      </section>

      <section style={styles.panel}>
        <div style={styles.panelHeader}>
          <div>
            <h3 style={styles.panelTitle}>{selectedSection.title}</h3>
            <p style={styles.panelSubtitle}>{selectedSection.helper}</p>
          </div>
        </div>

        <div style={styles.messageList}>
          {selectedSection.messages.map((message) => {
            const isSelected = message.key === selectedMessageKey;
            const hasSavedText = Boolean((msgs[message.key] ?? "").trim());

            return (
              <button
                key={message.key}
                type="button"
                onClick={() => setSelectedMessageKey(message.key)}
                style={{
                  ...styles.messageButton,
                  ...(isSelected ? styles.messageButtonActive : {}),
                }}
              >
                <div style={styles.messageButtonTop}>
                  <span style={styles.messageButtonTitle}>{message.title}</span>
                  <span
                    style={{
                      ...styles.statusPill,
                      ...(hasSavedText ? styles.statusPillSaved : {}),
                    }}
                  >
                    {hasSavedText ? "Saved" : "Blank"}
                  </span>
                </div>

                <div style={styles.messageButtonDescription}>
                  {message.description}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <MessageEditor
        title={selectedMessage.title}
        description={selectedMessage.description}
        value={msgs[selectedMessage.key]}
        onChange={(v) => setMsg(selectedMessage.key, v)}
      />
    </div>
  );
}

function MessageEditor({ title, description, value, onChange }) {
  return (
    <section style={styles.editorCard}>
      <div style={styles.editorHeader}>
        <div>
          <div style={styles.editorEyebrow}>Editing Message</div>
          <h3 style={styles.editorTitle}>{title}</h3>
          <p style={styles.editorDescription}>{description}</p>
        </div>

        <div style={styles.savedNote}>Saved automatically</div>
      </div>

      <textarea
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        rows={10}
        style={styles.textarea}
        placeholder="Write the saved message here..."
      />

      <div style={styles.tokenHelp}>
        Common placeholders: <strong>[Name]</strong>, <strong>[Date]</strong>,{" "}
        <strong>[List]</strong>
      </div>
    </section>
  );
}

const styles = {
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  title: {
    marginTop: 0,
    marginBottom: 6,
  },
  subtitle: {
    opacity: 0.78,
    marginTop: 0,
    marginBottom: 0,
    lineHeight: 1.45,
  },
  helpCard: {
    marginTop: 14,
    padding: 12,
    borderRadius: 14,
    border: "1px solid rgba(0,0,0,0.10)",
    background: "rgba(0,0,0,0.03)",
  },
  helpTitle: {
    fontWeight: 850,
    marginBottom: 4,
  },
  helpText: {
    fontSize: 13,
    opacity: 0.8,
    lineHeight: 1.45,
  },
  sectionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: 10,
    marginTop: 14,
  },
  sectionButton: {
    textAlign: "left",
    border: "1px solid rgba(0,0,0,0.12)",
    background: "white",
    borderRadius: 14,
    padding: 12,
    cursor: "pointer",
  },
  sectionButtonActive: {
    border: "2px solid rgba(0,0,0,0.70)",
    background: "rgba(0,0,0,0.04)",
  },
  sectionButtonTitle: {
    fontWeight: 850,
    fontSize: 14,
    marginBottom: 4,
  },
  sectionButtonHelper: {
    fontSize: 12,
    opacity: 0.72,
    lineHeight: 1.35,
    minHeight: 32,
  },
  sectionCount: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: 800,
    opacity: 0.72,
  },
  panel: {
    marginTop: 14,
    padding: 12,
    borderRadius: 16,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "white",
  },
  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10,
  },
  panelTitle: {
    margin: 0,
    fontSize: 16,
  },
  panelSubtitle: {
    marginTop: 4,
    marginBottom: 0,
    fontSize: 13,
    opacity: 0.72,
  },
  messageList: {
    display: "grid",
    gap: 8,
  },
  messageButton: {
    width: "100%",
    textAlign: "left",
    border: "1px solid rgba(0,0,0,0.10)",
    background: "rgba(0,0,0,0.02)",
    borderRadius: 12,
    padding: 10,
    cursor: "pointer",
  },
  messageButtonActive: {
    border: "2px solid rgba(0,0,0,0.70)",
    background: "white",
  },
  messageButtonTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  messageButtonTitle: {
    fontWeight: 850,
    fontSize: 14,
  },
  messageButtonDescription: {
    marginTop: 4,
    fontSize: 12,
    opacity: 0.72,
    lineHeight: 1.35,
  },
  statusPill: {
    flex: "0 0 auto",
    fontSize: 11,
    fontWeight: 850,
    borderRadius: 999,
    padding: "3px 8px",
    background: "rgba(0,0,0,0.08)",
    opacity: 0.8,
  },
  statusPillSaved: {
    background: "rgba(34,197,94,0.16)",
    opacity: 1,
  },
  editorCard: {
    marginTop: 14,
    padding: 12,
    borderRadius: 16,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "white",
  },
  editorHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 10,
  },
  editorEyebrow: {
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    opacity: 0.6,
    marginBottom: 3,
  },
  editorTitle: {
    margin: 0,
    fontSize: 18,
  },
  editorDescription: {
    marginTop: 5,
    marginBottom: 0,
    fontSize: 13,
    opacity: 0.72,
    lineHeight: 1.4,
  },
  savedNote: {
    flex: "0 0 auto",
    fontSize: 12,
    opacity: 0.72,
    fontWeight: 700,
    paddingTop: 2,
  },
  textarea: {
    width: "100%",
    resize: "vertical",
    padding: 10,
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.12)",
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: 13,
    lineHeight: 1.4,
    boxSizing: "border-box",
  },
  tokenHelp: {
    marginTop: 8,
    fontSize: 12,
    opacity: 0.72,
    lineHeight: 1.35,
  },
};