import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

const STORAGE_KEY = "referral_code";
const DEFAULT_REF = "RYVOVA3B";

export default function ReferralHandler() {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const ref = searchParams.get("ref") || searchParams.get("referral");
    if (ref && ref.trim()) {
      localStorage.setItem(STORAGE_KEY, ref.trim());
    } else if (!localStorage.getItem(STORAGE_KEY)) {
      localStorage.setItem(STORAGE_KEY, DEFAULT_REF);
    }
  }, [searchParams]);

  return null;
}
