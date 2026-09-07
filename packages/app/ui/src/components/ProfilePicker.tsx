import { useLocale } from "../locale.js";
import type { ProfileSummary } from "../types";

type ProfilePickerProps = {
  profiles: ProfileSummary[];
  value: string;
  disabled: boolean;
  onChange: (filename: string) => void;
};

export function ProfilePicker({
  profiles,
  value,
  disabled,
  onChange,
}: ProfilePickerProps) {
  const { t } = useLocale();
  return (
    <label className="field">
      <span className="field__label">{t.profile}</span>
      <select
        className="field__control"
        value={value}
        disabled={disabled || profiles.length === 0}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      >
        {profiles.length === 0 ? (
          <option value="">{t.noProfiles}</option>
        ) : (
          profiles.map((profile) => (
            <option key={profile.filename} value={profile.filename}>
              {profile.id}@{profile.version} · {profile.filename}
            </option>
          ))
        )}
      </select>
    </label>
  );
}
