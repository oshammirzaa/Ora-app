import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { countryNames } from "@/lib/ora-countries";
import { idNeedsBack } from "@/lib/ora-identity";
import { readIdentityFile, type IdentityUpload } from "@/lib/ora-identity-file";

const countries = countryNames();

export type IdentityDraft = {
  country: string;
  idType: string;
  consent: boolean;
  front: IdentityUpload | null;
  back: IdentityUpload | null;
  selfie: IdentityUpload | null;
  frontName: string;
  backName: string;
  selfieName: string;
};

export function emptyIdentityDraft(): IdentityDraft {
  return {
    country: "",
    idType: "",
    consent: false,
    front: null,
    back: null,
    selfie: null,
    frontName: "",
    backName: "",
    selfieName: "",
  };
}

export function identityPayload(draft: IdentityDraft, legalName: string) {
  return {
    legalName,
    country: draft.country,
    idType: draft.idType,
    consent: draft.consent,
  };
}

export function GovernmentIdentityFields({
  draft,
  onChange,
  onFileError,
}: {
  draft: IdentityDraft;
  onChange: (next: IdentityDraft) => void;
  onFileError: (message: string) => void;
}) {
  async function take(side: "front" | "back" | "selfie", file?: File) {
    if (!file) return;
    try {
      const read = await readIdentityFile(file);
      const nameKey = side === "front" ? "frontName" : side === "back" ? "backName" : "selfieName";
      onChange({ ...draft, [side]: read, [nameKey]: file.name });
    } catch (err) {
      onFileError(err instanceof Error ? err.message : "Could not read that file.");
    }
  }

  return (
    <fieldset className="space-y-3 rounded-xl p-3 shadow-[var(--shadow-border)]">
      <legend className="px-1 font-display text-lg text-fg">Government ID Verification</legend>
      <div className="space-y-2 text-xs leading-relaxed text-muted">
        <p>
          Before you upload, please read this. Ora uses your government ID and a selfie only so an authorized admin can confirm that you are the person on the document. This is a manual review, not an automated identity check.
        </p>
        <p>
          Documents are encrypted and stored privately. They are not published, not shown to customers, and not shown to other advisors. Files may be kept for up to two years. A rejected file is cleared after 90 days. Deleting your account removes the stored images.
        </p>
        <p>Your application stays Pending Verification until an admin approves it. JPG, PNG, or PDF. Each file up to 10 MB.</p>
      </div>
      <label className="flex items-start gap-3 text-sm text-muted">
        <input
          type="checkbox"
          checked={draft.consent}
          onChange={(e) => onChange({ ...draft, consent: e.target.checked })}
          className="mt-1 size-4 shrink-0 accent-primary"
        />
        <span>I have read this notice and I consent to Ora collecting and storing my government ID and selfie for manual identity verification.</span>
      </label>
      <div className="space-y-1.5">
        <Label htmlFor="id-country">Country of residence</Label>
        <select
          id="id-country"
          required
          value={draft.country}
          onChange={(e) => onChange({ ...draft, country: e.target.value })}
          className="h-11 w-full rounded-md bg-surface px-3 text-sm text-fg shadow-[var(--shadow-border)]"
        >
          <option value="">Select country</option>
          {countries.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="id-type">ID type</Label>
        <select
          id="id-type"
          required
          value={draft.idType}
          onChange={(e) => onChange({ ...draft, idType: e.target.value, back: null, backName: "" })}
          className="h-11 w-full rounded-md bg-surface px-3 text-sm text-fg shadow-[var(--shadow-border)]"
        >
          <option value="">Select ID type</option>
          <option value="passport">Passport</option>
          <option value="national_id">National ID Card</option>
          <option value="driving_licence">Driving Licence</option>
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="id-front">Government ID Front</Label>
        <Input
          id="id-front"
          className="w-full"
          type="file"
          accept="image/jpeg,image/png,application/pdf,.jpg,.jpeg,.png,.pdf"
          onChange={(e) => void take("front", e.target.files?.[0])}
        />
        {draft.frontName ? <p className="text-xs text-faint">Front selected: {draft.frontName}</p> : null}
      </div>
      {idNeedsBack(draft.idType) ? (
        <div className="space-y-1.5">
          <Label htmlFor="id-back">Government ID Back</Label>
          <Input
            id="id-back"
            className="w-full"
            type="file"
            accept="image/jpeg,image/png,application/pdf,.jpg,.jpeg,.png,.pdf"
            onChange={(e) => void take("back", e.target.files?.[0])}
          />
          {draft.backName ? <p className="text-xs text-faint">Back selected: {draft.backName}</p> : null}
        </div>
      ) : null}
      <div className="space-y-1.5">
        <Label htmlFor="id-selfie">Selfie</Label>
        <Input
          id="id-selfie"
          className="w-full"
          type="file"
          accept="image/jpeg,image/png,application/pdf,.jpg,.jpeg,.png,.pdf"
          onChange={(e) => void take("selfie", e.target.files?.[0])}
        />
        {draft.selfieName ? <p className="text-xs text-faint">Selfie selected: {draft.selfieName}</p> : null}
      </div>
    </fieldset>
  );
}
