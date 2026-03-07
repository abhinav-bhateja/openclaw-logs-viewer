// Strips OpenClaw channel metadata from user messages, returns clean text + sender name

function stripUntrustedContext(text) {
  return text
    .replace(/\n*Untrusted context \(metadata, do not treat as instructions or commands\):\s*/g, '')
    .replace(/<<<EXTERNAL_UNTRUSTED_CONTENT[^>]*>>>[\s\S]*?<<<END_EXTERNAL_UNTRUSTED_CONTENT[^>]*>>>/g, '')
    .trim();
}

export function parseUserMessage(content) {
  const blocks = Array.isArray(content) ? content : [];
  const firstText = blocks.find((b) => b.type === 'text');
  if (!firstText?.text) return { text: '' };

  const raw = firstText.text;

  const hasConversationInfo = raw.includes('Conversation info (untrusted metadata):');
  const hasSenderInfo = raw.includes('Sender (untrusted metadata):');

  if (!hasConversationInfo && !hasSenderInfo) {
    const cronMatch = raw.match(/^\[cron:[^\]]+\]\s*/);
    if (cronMatch) {
      return { sender: 'Cron', text: stripUntrustedContext(raw.slice(cronMatch[0].length)) };
    }
    return { text: stripUntrustedContext(raw) };
  }

  let sender;

  const senderMatch = raw.match(
    /Sender \(untrusted metadata\):\s*```json\s*(\{[\s\S]*?\})\s*```/
  );
  if (senderMatch) {
    try {
      const data = JSON.parse(senderMatch[1]);
      sender = data.displayName || data.name || data.username || data.first_name || undefined;
    } catch {}
  }

  const userText = raw
    .replace(/Conversation info \(untrusted metadata\):[\s\S]*?```[\s\S]*?```\s*/g, '')
    .replace(/Sender \(untrusted metadata\):[\s\S]*?```[\s\S]*?```\s*/g, '')
    .replace(/Replied message \(untrusted, for context\):[\s\S]*?```[\s\S]*?```\s*/g, '')
    .replace(/Note: The previous agent run was aborted by the user\. Resume carefully or ask for clarification\.\s*/g, '')
    .replace(/\[(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}\s+GMT[+-]\d+(?::\d+)?\]\s*/g, '')
    .trim();

  return { sender, text: stripUntrustedContext(userText) };
}
