export const RealmInfo = ({
  level = 1,
  population = 100,
  storage = 1000,
}: {
  level: number;
  population: number;
  storage: number;
}) => (
  <div className="bg-brown/20 p-4 rounded-lg">
    <h3 className="text-2xl font-bold mb-2">Realm Info</h3>
    <div className="grid grid-cols-4 gap-4">
      <div>
        <span className="text-gold/80">Level:</span>
        <span className="ml-2">{level}</span>
      </div>
      <div>
        <span className="text-gold/80">Population:</span>
        <span className="ml-2">{population}</span>
      </div>
      <div>
        <span className="text-gold/80">Storage:</span>
        <span className="ml-2">{storage}</span>
      </div>
    </div>
  </div>
);
