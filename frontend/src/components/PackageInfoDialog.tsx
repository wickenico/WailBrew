import { ArrowRight, ArrowUpRight, Check, Copy, Package, Terminal, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { GetCaskIcon } from "../../wailsjs/go/main/App";
import { BrowserOpenURL } from "../../wailsjs/runtime/runtime";
import { useModalA11y } from "../hooks/useModalA11y";
import type { PackageEntry } from "../types";
import { parseInfoLog } from "../utils/parseInfoLog";

interface Props {
    open: boolean;
    title: string;
    log: string | null;
    onClose: () => void;
    isRunning?: boolean;
    packageEntry?: PackageEntry | null;
    onNavigateToOutdated?: () => void;
    onSelectDependency?: (dependencyName: string) => void;
}

export default function PackageInfoDialog({
    open,
    title,
    log,
    onClose,
    isRunning = false,
    packageEntry,
    onNavigateToOutdated,
    onSelectDependency,
}: Props) {
    const { t } = useTranslation();
    const [raw, setRaw] = useState(false);
    const [copied, setCopied] = useState(false);
    const [caskIcon, setCaskIcon] = useState("");
    const boxRef = useRef<HTMLDivElement>(null);
    const parsed = useMemo(() => parseInfoLog(log), [log]);
    const name = packageEntry?.name || parsed?.headline.split(/[ :✔]/)[0] || title;
    const sections = parsed?.sections || [];
    const isCask =
        packageEntry?.isCask === true ||
        sections.some((section) => section.title === "Artifacts") ||
        /✔\s+\([^)]+\):/.test(parsed?.headline || "");
    useModalA11y(open, onClose, boxRef);
    useEffect(() => {
        if (open) {
            setRaw(false);
            setCopied(false);
        }
    }, [open, packageEntry?.name]);
    useEffect(() => {
        let cancelled = false;
        setCaskIcon("");
        if (!open || !isCask || packageEntry?.isInstalled === false) return;

        GetCaskIcon(name)
            .then((icon) => {
                if (!cancelled && icon) setCaskIcon(icon);
            })
            .catch(() => {
                // The generic package mark remains when the cask has no .app icon.
            });
        return () => {
            cancelled = true;
        };
    }, [open, isCask, name, packageEntry?.isInstalled]);
    if (!open) return null;
    const label = (key: string, fallback: string) => t(`infoInspector.${key}`, { defaultValue: fallback });
    const field = (name: string) => parsed?.entries.find((entry) => entry.label === name)?.value;
    const version = packageEntry?.installedVersion;
    const available =
        parsed?.headline.match(/(?:stable |→ stable |-> stable )(\d[^ ,]*)/)?.[1] ||
        packageEntry?.latestVersion ||
        parsed?.headline.match(/: (\d[^ ,]*)/)?.[1];
    const isInstalled = packageEntry?.isInstalled === true || Boolean(version);
    const hasUpdate = version && available && version !== available;
    const valid = !isRunning && /^==> /m.test(log || "");
    const metadata = [
        [label("license", "License"), field("License")],
        [label("aliases", "Aliases"), field("Aliases")],
    ].filter((row): row is [string, string] => Boolean(row[1]));
    const link = (url: string | undefined, text: string) =>
        url && /^https?:\/\//i.test(url) ? (
            <a
                href={url}
                onClick={(event) => {
                    event.preventDefault();
                    BrowserOpenURL(url);
                }}
            >
                {text}
                <ArrowUpRight size={13} />
            </a>
        ) : null;
    return (
        <div className="confirm-overlay">
            <div
                className="confirm-box info-inspector"
                ref={boxRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="package-info-dialog-title"
                tabIndex={-1}
            >
                <div className="inspector-topbar">
                    <span>{label("title", "Package inspector")}</span>
                    <button
                        type="button"
                        className="inspector-close"
                        onClick={onClose}
                        aria-label={label("close", "Close")}
                    >
                        <X size={17} />
                    </button>
                </div>
                <header className="inspector-identity">
                    <div className={`inspector-mark ${caskIcon ? "has-app-icon" : ""}`}>
                        {caskIcon ? (
                            <img src={caskIcon} alt="" onError={() => setCaskIcon("")} />
                        ) : (
                            <Package size={28} strokeWidth={1.4} />
                        )}
                        <span />
                    </div>
                    <div>
                        <div className="inspector-name">
                            <h2 id="package-info-dialog-title">{name}</h2>
                            <span className="inspector-kind">{isCask ? "CASK" : "FORMULA"}</span>
                        </div>
                        <p>{valid ? parsed?.description : title}</p>
                    </div>
                </header>
                <div className="inspector-nav">
                    <div className="inspector-switch">
                        <button type="button" aria-pressed={!raw} onClick={() => setRaw(false)}>
                            {label("overview", "Overview")}
                        </button>
                        <button type="button" aria-pressed={raw} onClick={() => setRaw(true)}>
                            <Terminal size={13} />
                            {label("raw", "Raw output")}
                        </button>
                    </div>
                    {valid && hasUpdate && onNavigateToOutdated ? (
                        <button
                            type="button"
                            className="inspector-status has-update is-link"
                            onClick={onNavigateToOutdated}
                        >
                            <span />
                            {label("update", "Update available")}
                            <ArrowUpRight size={12} />
                        </button>
                    ) : valid ? (
                        <span className="inspector-status">
                            <span />
                            {isInstalled ? label("installed", "Installed") : label("available", "Available")}
                        </span>
                    ) : null}
                </div>
                <div className="inspector-body" aria-busy={isRunning}>
                    {raw || !valid ? (
                        <pre className="inspector-raw">{log}</pre>
                    ) : (
                        <>
                            <section className="inspector-section">
                                <h3>{label("details", "Details")}</h3>
                                <dl>
                                    {(version || available) && (
                                        <div className={`inspector-version-row ${hasUpdate ? "has-update" : ""}`}>
                                            <dt>{label("version", "Version")}</dt>
                                            <dd>
                                                {isInstalled && (
                                                    <span className="inspector-version installed">
                                                        <small>{label("installed", "Installed")}</small>
                                                        <strong>{version}</strong>
                                                    </span>
                                                )}
                                                {hasUpdate && (
                                                    <ArrowRight className="inspector-version-arrow" size={14} />
                                                )}
                                                {(!isInstalled || hasUpdate) && (
                                                    <span
                                                        className={`inspector-version ${hasUpdate ? "latest" : "available"}`}
                                                    >
                                                        <small>
                                                            {hasUpdate
                                                                ? label("latest", "Latest")
                                                                : label("available", "Available")}
                                                        </small>
                                                        <strong>{available || "—"}</strong>
                                                    </span>
                                                )}
                                            </dd>
                                        </div>
                                    )}
                                    {metadata.map(([key, value]) => (
                                        <div key={key}>
                                            <dt>{key}</dt>
                                            <dd>{value}</dd>
                                        </div>
                                    ))}
                                    {parsed?.homepage && (
                                        <div>
                                            <dt>{label("homepage", "Homepage")}</dt>
                                            <dd>
                                                {link(
                                                    parsed.homepage,
                                                    parsed.homepage.replace(/^https?:\/\//, "").replace(/\/$/, ""),
                                                )}
                                            </dd>
                                        </div>
                                    )}
                                    {field("From") && (
                                        <div>
                                            <dt>{label("source", "Source")}</dt>
                                            <dd>{link(field("From"), label("recipe", "Homebrew recipe"))}</dd>
                                        </div>
                                    )}
                                </dl>
                            </section>
                            {sections.map((section) => {
                                if (!section.body) return null;
                                if (section.title === "Analytics") {
                                    const rows = section.body
                                        .split("\n")
                                        .map((line) => ({
                                            name: line.split(":")[0],
                                            values: Object.fromEntries(
                                                [...line.matchAll(/([\d,]+)\s*\((30|90|365) days\)/g)].map((match) => [
                                                    match[2],
                                                    match[1],
                                                ]),
                                            ),
                                        }))
                                        .filter((row) => Object.keys(row.values).length);
                                    return rows.length ? (
                                        <section className="inspector-section" key={section.title}>
                                            <h3>
                                                {label("analytics", "Analytics")}
                                                <span>{label("community", "Across Homebrew")}</span>
                                            </h3>
                                            <table>
                                                <thead>
                                                    <tr>
                                                        <th>{label("metric", "Metric")}</th>
                                                        {[30, 90, 365].map((days) => (
                                                            <th key={days}>
                                                                {t("infoInspector.days", {
                                                                    count: days,
                                                                    defaultValue: `${days} days`,
                                                                })}
                                                            </th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {rows.map((row) => (
                                                        <tr key={row.name}>
                                                            <td>{row.name}</td>
                                                            {[30, 90, 365].map((days) => (
                                                                <td key={days}>{row.values[days] || "—"}</td>
                                                            ))}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </section>
                                    ) : null;
                                }
                                if (section.title === "Dependencies")
                                    return (
                                        <section className="inspector-section" key={section.title}>
                                            <h3>{label("dependencies", "Dependencies")}</h3>
                                            {section.body
                                                .split("\n")
                                                .filter(Boolean)
                                                .map((line) => {
                                                    const [heading, ...rest] = line.split(":");
                                                    return (
                                                        <div className="inspector-dep-group" key={line}>
                                                            <span>{heading}</span>
                                                            <div>
                                                                {rest.length
                                                                    ? rest
                                                                          .join(":")
                                                                          .split(",")
                                                                          .map((dep) => dep.trim())
                                                                          .filter(Boolean)
                                                                          .map((dep) =>
                                                                              onSelectDependency ? (
                                                                                  <button
                                                                                      type="button"
                                                                                      className="inspector-dependency"
                                                                                      key={dep}
                                                                                      onClick={() =>
                                                                                          onSelectDependency(dep)
                                                                                      }
                                                                                      title={label(
                                                                                          "openDependency",
                                                                                          `Open ${dep}`,
                                                                                      )}
                                                                                  >
                                                                                      <code>{dep}</code>
                                                                                      <ArrowUpRight size={10} />
                                                                                  </button>
                                                                              ) : (
                                                                                  <code key={dep}>{dep}</code>
                                                                              ),
                                                                          )
                                                                    : null}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                        </section>
                                    );
                                return (
                                    <section
                                        className={`inspector-section ${section.title === "Caveats" ? "inspector-caveats" : ""}`}
                                        key={section.title}
                                    >
                                        <h3>{section.title}</h3>
                                        <pre>{section.body}</pre>
                                    </section>
                                );
                            })}
                            {field("Path") && (
                                <section className="inspector-section">
                                    <h3>{label("location", "Location")}</h3>
                                    <pre>{field("Path")}</pre>
                                </section>
                            )}
                        </>
                    )}
                </div>
                <footer className="inspector-footer">
                    <span className="inspector-command">
                        <Terminal size={13} />
                        brew info {name}
                    </span>
                    <button
                        type="button"
                        disabled={!log || isRunning}
                        onClick={async () => {
                            try {
                                await navigator.clipboard.writeText(log || "");
                                setCopied(true);
                            } catch {
                                toast.error(t("logDialog.copyFailed"));
                            }
                        }}
                    >
                        {copied ? <Check size={14} /> : <Copy size={14} />}{" "}
                        {copied ? t("logDialog.copiedToClipboard") : label("copy", "Copy raw output")}
                    </button>
                </footer>
            </div>
        </div>
    );
}
