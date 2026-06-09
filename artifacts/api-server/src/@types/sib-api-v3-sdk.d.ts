declare module 'sib-api-v3-sdk' {
  export class ApiClient {
    static instance: any;
  }
  
  export class Configuration {
    constructor(apiKey?: string);
  }
  
  export class ContactsApi {
    constructor(configuration: Configuration);
    createContact(params: any): Promise<any>;
    getApi(): any;
  }
  
  export class TransactionalEmailsApi {
    constructor(configuration?: Configuration);
    sendTransacEmail(params: any): Promise<any>;
    getApi(): any;
  }
  
  export default {
    ApiClient,
    Configuration,
    ContactsApi,
    TransactionalEmailsApi,
    SendSmtpEmail: any
  };
}