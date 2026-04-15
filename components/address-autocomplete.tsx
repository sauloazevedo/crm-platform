"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./crm-shell.module.css";

declare global {
  interface Window {
    google?: any;
  }
}

type AddressAutocompleteProps = {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
};

type AddressSuggestion = {
  id: string;
  label: string;
  prediction?: any;
};

let googlePlacesPromise: Promise<any> | null = null;

function loadGooglePlaces(apiKey: string) {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Places can only run in the browser."));
  }

  if (googlePlacesPromise) {
    return googlePlacesPromise;
  }

  googlePlacesPromise = new Promise((resolve, reject) => {
    const loadPlacesLibrary = async () => {
      try {
        const places = await window.google?.maps?.importLibrary?.("places");
        resolve(places);
      } catch (error) {
        reject(error);
      }
    };

    if (window.google?.maps?.importLibrary) {
      void loadPlacesLibrary();
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>("script[data-smart-crm-google-maps]");

    if (existingScript) {
      existingScript.addEventListener("load", () => void loadPlacesLibrary(), { once: true });
      existingScript.addEventListener("error", reject, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.async = true;
    script.defer = true;
    script.dataset.smartCrmGoogleMaps = "true";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      apiKey
    )}&libraries=places&v=weekly&loading=async`;
    script.onload = () => void loadPlacesLibrary();
    script.onerror = reject;
    document.head.appendChild(script);
  });

  return googlePlacesPromise;
}

function getSuggestionLabel(prediction: any) {
  if (!prediction) {
    return "";
  }

  return prediction.text?.toString?.() ?? prediction.text?.text ?? prediction.description ?? "";
}

export function AddressAutocomplete({
  value,
  onChange,
  onBlur,
  placeholder = "Address",
  inputMode,
}: AddressAutocompleteProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [placesLibrary, setPlacesLibrary] = useState<any>(null);
  const autocompleteServiceRef = useRef<any>(null);
  const sessionTokenRef = useRef<any>(null);

  const canSearch = useMemo(() => Boolean(apiKey && placesLibrary && value.trim().length >= 3), [
    apiKey,
    placesLibrary,
    value,
  ]);

  useEffect(() => {
    if (!apiKey) {
      return;
    }

    let isMounted = true;

    loadGooglePlaces(apiKey)
      .then((library) => {
        if (isMounted) {
          setPlacesLibrary(library);
        }
      })
      .catch((error) => {
        console.warn("[AddressAutocomplete] failed to load Google Places:", error);
        setLoadError(true);
      });

    return () => {
      isMounted = false;
    };
  }, [apiKey]);

  useEffect(() => {
    if (!canSearch) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    let isCancelled = false;
    const timeoutId = window.setTimeout(async () => {
      try {
        setIsLoading(true);

        if (!sessionTokenRef.current) {
          sessionTokenRef.current = new placesLibrary.AutocompleteSessionToken();
        }

        if (placesLibrary.AutocompleteSuggestion?.fetchAutocompleteSuggestions) {
          const response = await placesLibrary.AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input: value,
            sessionToken: sessionTokenRef.current,
            includedRegionCodes: ["us"],
          });

          if (isCancelled) {
            return;
          }

          const nextSuggestions = (response.suggestions ?? [])
            .map((suggestion: any, index: number) => {
              const prediction = suggestion.placePrediction;
              const label = getSuggestionLabel(prediction);

              return label ? { id: prediction.placeId ?? `${label}-${index}`, label, prediction } : null;
            })
            .filter(Boolean)
            .slice(0, 5) as AddressSuggestion[];

          setSuggestions(nextSuggestions);
          setIsOpen(nextSuggestions.length > 0);
          return;
        }

        if (!autocompleteServiceRef.current) {
          autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService();
        }

        autocompleteServiceRef.current.getPlacePredictions(
          {
            input: value,
            componentRestrictions: { country: "us" },
            types: ["address"],
          },
          (predictions: any[] | null, status: string) => {
            if (isCancelled) {
              return;
            }

            if (status !== window.google.maps.places.PlacesServiceStatus.OK || !predictions) {
              setSuggestions([]);
              setIsOpen(false);
              return;
            }

            const nextSuggestions = predictions.slice(0, 5).map((prediction, index) => ({
              id: prediction.place_id ?? `${prediction.description}-${index}`,
              label: prediction.description,
            }));

            setSuggestions(nextSuggestions);
            setIsOpen(nextSuggestions.length > 0);
          }
        );
      } catch (error) {
        console.warn("[AddressAutocomplete] failed to fetch suggestions:", error);
        setSuggestions([]);
        setIsOpen(false);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }, 250);

    return () => {
      isCancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [canSearch, placesLibrary, value]);

  async function selectSuggestion(suggestion: AddressSuggestion) {
    if (!suggestion.prediction?.toPlace) {
      onChange(suggestion.label);
      setIsOpen(false);
      setSuggestions([]);
      return;
    }

    try {
      const place = suggestion.prediction.toPlace();
      await place.fetchFields({ fields: ["formattedAddress"] });

      onChange(place.formattedAddress ?? suggestion.label);
      sessionTokenRef.current = null;
    } catch (error) {
      console.warn("[AddressAutocomplete] failed to select suggestion:", error);
      onChange(suggestion.label);
    } finally {
      setIsOpen(false);
      setSuggestions([]);
    }
  }

  return (
    <div className={styles.addressAutocomplete}>
      <input
        value={value}
        inputMode={inputMode}
        onBlur={() => {
          window.setTimeout(() => setIsOpen(false), 160);
          onBlur?.();
        }}
        onChange={(event) => {
          onChange(event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => {
          if (suggestions.length > 0) {
            setIsOpen(true);
          }
        }}
        placeholder={placeholder}
      />

      {isOpen && (suggestions.length > 0 || isLoading || loadError) ? (
        <div className={styles.addressSuggestions}>
          {suggestions.map((suggestion) => (
            <button key={suggestion.id} type="button" onMouseDown={() => selectSuggestion(suggestion)}>
              {suggestion.label}
            </button>
          ))}
          {isLoading ? <span>Searching addresses...</span> : null}
          {loadError ? <span>Google address search is not available yet.</span> : null}
        </div>
      ) : null}
    </div>
  );
}
