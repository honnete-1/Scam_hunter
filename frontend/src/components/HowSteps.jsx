const STEPS = [
  {
    title: "Choose what to check",
    text: "A message, a link or a phone number. Paste it in as you received it.",
  },
  {
    title: "Scam Hunter looks for warning signs",
    text: "It checks for patterns like urgency or requests for your PIN, and compares links and numbers with records moderators have approved.",
  },
  {
    title: "You decide what to do next",
    text: "You get a concern level, the reasons behind it and a safer next step.",
  },
];

export default function HowSteps() {
  return (
    <ol className="steps">
      {STEPS.map((step, index) => (
        <li className="step" key={step.title}>
          <span className="step__number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
          <h3>{step.title}</h3>
          <p>{step.text}</p>
        </li>
      ))}
    </ol>
  );
}
