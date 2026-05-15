import * as Contacts from 'expo-contacts';

class ContactsService {
  private cache = new Map<string, string>();
  private fullContacts: { name: string; number: string }[] = [];
  private loaded = false;

  async load(): Promise<void> {
    if (this.loaded) return;
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') return;
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
      });
      
      const newFullContacts: { name: string; number: string }[] = [];
      for (const contact of data) {
        if (!contact.name) continue;
        for (const phone of contact.phoneNumbers ?? []) {
          if (phone.number) {
            const normalized = this.normalize(phone.number);
            this.cache.set(normalized, contact.name);
            newFullContacts.push({ name: contact.name, number: phone.number });
          }
        }
      }
      this.fullContacts = newFullContacts;
      this.loaded = true;
    } catch (e) {
      console.warn('[ContactsService] load failed:', e);
    }
  }

  getName(phoneNumber: string): string | null {
    return this.cache.get(this.normalize(phoneNumber)) ?? null;
  }

  getAll(): { name: string; number: string }[] {
    return this.fullContacts;
  }

  private normalize(phone: string): string {
    let digits = phone.replace(/\D/g, '');
    if (digits.startsWith('39') && digits.length > 10) digits = digits.slice(2);
    return digits;
  }
}

export const contactsService = new ContactsService();
