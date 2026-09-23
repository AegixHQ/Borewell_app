import { JOB_STAGES, STAGE_LABELS, CUSTOMER_STEPS, customerStepIndex, stageIndex } from "shared-ui";
import Icon from "./Icon.jsx";

/** Full 14-stage rail, as enforced by platform-spine's state machine. */
export function StageRail({ status }) {
  const current = stageIndex(status);
  return (
    <div className="rail">
      {JOB_STAGES.map((stage, i) => {
        const state = i < current ? "done" : i === current ? "current" : "todo";
        return (
          <div key={stage}>
            <div className={`rail-item ${state}`}>
              <span className="rail-dot">{state === "done" && <Icon name="check" size={12} strokeWidth={3} />}</span>
              <span>{STAGE_LABELS[stage]}</span>
            </div>
            {i < JOB_STAGES.length - 1 && <span className={`rail-line ${i < current ? "done" : ""}`} />}
          </div>
        );
      })}
    </div>
  );
}

/** The 5 steps a customer sees, mapped from the same 14 backend stages. */
export function CustomerSteps({ status }) {
  const current = customerStepIndex(status);
  return (
    <div className="steps">
      {CUSTOMER_STEPS.map((step, i) => (
        <div key={step.label} className={`step ${i < current ? "done" : i === current ? "current" : ""}`}>
          <span className="bar" />
          <span>{step.label}</span>
        </div>
      ))}
    </div>
  );
}
