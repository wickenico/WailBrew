export namespace brew {
	
	export class AdoptCandidate {
	    token: string;
	    fullToken: string;
	    name: string;
	    desc: string;
	    homepage: string;
	    version: string;
	    autoUpdates: boolean;
	    deprecated: boolean;
	    matchKind: string;
	    versionStatus: string;
	
	    static createFrom(source: any = {}) {
	        return new AdoptCandidate(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.token = source["token"];
	        this.fullToken = source["fullToken"];
	        this.name = source["name"];
	        this.desc = source["desc"];
	        this.homepage = source["homepage"];
	        this.version = source["version"];
	        this.autoUpdates = source["autoUpdates"];
	        this.deprecated = source["deprecated"];
	        this.matchKind = source["matchKind"];
	        this.versionStatus = source["versionStatus"];
	    }
	}
	export class UnmatchedApp {
	    appName: string;
	    path: string;
	    bundleId: string;
	    version: string;
	
	    static createFrom(source: any = {}) {
	        return new UnmatchedApp(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.appName = source["appName"];
	        this.path = source["path"];
	        this.bundleId = source["bundleId"];
	        this.version = source["version"];
	    }
	}
	export class AdoptableApp {
	    appName: string;
	    path: string;
	    bundleId: string;
	    version: string;
	    status: string;
	    candidates: AdoptCandidate[];
	
	    static createFrom(source: any = {}) {
	        return new AdoptableApp(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.appName = source["appName"];
	        this.path = source["path"];
	        this.bundleId = source["bundleId"];
	        this.version = source["version"];
	        this.status = source["status"];
	        this.candidates = this.convertValues(source["candidates"], AdoptCandidate);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class AdoptScanResult {
	    appDir: string;
	    apps: AdoptableApp[];
	    unmatched: UnmatchedApp[];
	    managedCount: number;
	    appStoreApps: string[];
	    systemCount: number;
	    catalogStale: boolean;
	
	    static createFrom(source: any = {}) {
	        return new AdoptScanResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.appDir = source["appDir"];
	        this.apps = this.convertValues(source["apps"], AdoptableApp);
	        this.unmatched = this.convertValues(source["unmatched"], UnmatchedApp);
	        this.managedCount = source["managedCount"];
	        this.appStoreApps = source["appStoreApps"];
	        this.systemCount = source["systemCount"];
	        this.catalogStale = source["catalogStale"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class Vulnerability {
	    id: string;
	    severity: string;
	    summary: string;
	    aliases: string[];
	    fixedVersions: string[];
	    fixAvailable: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Vulnerability(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.severity = source["severity"];
	        this.summary = source["summary"];
	        this.aliases = source["aliases"];
	        this.fixedVersions = source["fixedVersions"];
	        this.fixAvailable = source["fixAvailable"];
	    }
	}
	export class FormulaFindings {
	    formula: string;
	    version: string;
	    repoUrl: string;
	    vulnerabilities: Vulnerability[];
	
	    static createFrom(source: any = {}) {
	        return new FormulaFindings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.formula = source["formula"];
	        this.version = source["version"];
	        this.repoUrl = source["repoUrl"];
	        this.vulnerabilities = this.convertValues(source["vulnerabilities"], Vulnerability);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class NewPackagesInfo {
	    newFormulae: string[];
	    newCasks: string[];
	
	    static createFrom(source: any = {}) {
	        return new NewPackagesInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.newFormulae = source["newFormulae"];
	        this.newCasks = source["newCasks"];
	    }
	}
	export class SnapshotEntry {
	    fileName: string;
	    label: string;
	    createdAt: string;
	    size: number;
	
	    static createFrom(source: any = {}) {
	        return new SnapshotEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.fileName = source["fileName"];
	        this.label = source["label"];
	        this.createdAt = source["createdAt"];
	        this.size = source["size"];
	    }
	}
	export class StartupData {
	    packages: string[][];
	    casks: string[][];
	    updatable: string[][];
	    leaves: string[];
	    taps: string[][];
	
	    static createFrom(source: any = {}) {
	        return new StartupData(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.packages = source["packages"];
	        this.casks = source["casks"];
	        this.updatable = source["updatable"];
	        this.leaves = source["leaves"];
	        this.taps = source["taps"];
	    }
	}
	
	
	export class VulnerabilityReport {
	    findings: FormulaFindings[];
	    skippedFormulae: string[];
	    checked: number;
	    complete: boolean;
	    outdatedWithoutSbom: string[];
	    unscannedFormulae: Record<string, string>;
	
	    static createFrom(source: any = {}) {
	        return new VulnerabilityReport(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.findings = this.convertValues(source["findings"], FormulaFindings);
	        this.skippedFormulae = source["skippedFormulae"];
	        this.checked = source["checked"];
	        this.complete = source["complete"];
	        this.outdatedWithoutSbom = source["outdatedWithoutSbom"];
	        this.unscannedFormulae = source["unscannedFormulae"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace main {
	
	export class BrewLocationSuggestion {
	    currentPath: string;
	    suggestedPath: string;
	    hasSuggestion: boolean;
	
	    static createFrom(source: any = {}) {
	        return new BrewLocationSuggestion(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.currentPath = source["currentPath"];
	        this.suggestedPath = source["suggestedPath"];
	        this.hasSuggestion = source["hasSuggestion"];
	    }
	}
	export class UpdateInfo {
	    available: boolean;
	    currentVersion: string;
	    latestVersion: string;
	    installedViaHomebrew: boolean;
	    releaseUrl: string;
	
	    static createFrom(source: any = {}) {
	        return new UpdateInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.available = source["available"];
	        this.currentVersion = source["currentVersion"];
	        this.latestVersion = source["latestVersion"];
	        this.installedViaHomebrew = source["installedViaHomebrew"];
	        this.releaseUrl = source["releaseUrl"];
	    }
	}

}

