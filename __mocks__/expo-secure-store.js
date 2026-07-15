// In-memory zamena za Keychain/Keystore — samo za testove!
const store = new Map();

module.exports = {
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
  async getItemAsync(key) {
    return store.has(key) ? store.get(key) : null;
  },
  async setItemAsync(key, value) {
    store.set(key, value);
  },
  async deleteItemAsync(key) {
    store.delete(key);
  },
  // pomoćna funkcija za testove — resetuje "Keystore" između testova
  __reset() {
    store.clear();
  },
};
