
const generateUniqueIdentifier = () => {
  function generateIdentifier() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0,
                v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    var newIdentifier = generateIdentifier();
    var currentDatetimeWithTimezone = new Date().toISOString();

    var newIdentifierWithTimezone = newIdentifier + "_" + currentDatetimeWithTimezone;

    return newIdentifierWithTimezone;
};

module.exports = generateUniqueIdentifier;
