export namespace main {
	
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

