import { useId } from "react";
import Icon from "@mdi/react";
import { mdiCheck, mdiClose, mdiHelpCircleOutline } from "@mdi/js";
import { effectiveAttendanceStatus } from "./attendeeList";

const RSVP_ICONS = [
  { status: "yes", label: "Jdu", icon: mdiCheck },
  { status: "no", label: "Nejdu", icon: mdiClose },
  { status: "maybe", label: "Nevím", icon: mdiHelpCircleOutline },
];

export default function AttendanceIcons({ status, disabled, onSelect, name, legend }) {
  const current = effectiveAttendanceStatus(status);
  const legendId = useId();
  if (!onSelect) {
    const item = RSVP_ICONS.find((entry) => entry.status === current);
    return (
      <span
        className={`event-rsvp-icon event-rsvp-icon--${item.status}`}
        aria-label={name ? `${name}: ${item.label}` : item.label}
        title={item.label}
      >
        <Icon path={item.icon} size={0.9} />
      </span>
    );
  }
  return (
    <div
      className={`event-rsvp${legend ? " event-rsvp--labelled" : ""}`}
      role="group"
      aria-labelledby={legend ? legendId : undefined}
      aria-label={legend ? undefined : name ? `Účast: ${name}` : "Moje účast"}
    >
      {legend ? (
        <span className="event-rsvp-legend" id={legendId}>
          {legend}
        </span>
      ) : null}
      <div className="event-rsvp-choices">
        {RSVP_ICONS.map((item) => {
          const active = item.status === current;
          const label = name ? `${name}: ${item.label}` : item.label;
          return (
            <button
              key={item.status}
              type="button"
              className={`event-rsvp-btn event-rsvp-btn--${item.status}${active ? " is-active" : ""}`}
              aria-label={label}
              title={item.label}
              aria-pressed={active}
              disabled={disabled}
              onClick={() => onSelect(item.status)}
            >
              <Icon path={item.icon} size={0.9} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
