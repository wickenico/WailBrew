export namespace brew {
	
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
	    releaseNotes: string;
	    downloadUrl: string;
	    fileSize: number;
	    publishedAt: string;
	
	    static createFrom(source: any = {}) {
	        return new UpdateInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.available = source["available"];
	        this.currentVersion = source["currentVersion"];
	        this.latestVersion = source["latestVersion"];
	        this.releaseNotes = source["releaseNotes"];
	        this.downloadUrl = source["downloadUrl"];
	        this.fileSize = source["fileSize"];
	        this.publishedAt = source["publishedAt"];
	    }
	}

}

